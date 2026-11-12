import { num, str } from '../../core/plate';
import type { SystemsKernel } from '../../engines/systems/sim';
import * as M from './_merkle';

// Two parts on one timeline. Replica B repairs its copy of A's blocks by descending A's Merkle
// tree: it asks for the root, and wherever a digest differs from its own it asks for the two
// children, down to the blocks that differ, which alone are transferred. Meanwhile A keeps an
// append-only log as a hash chain and reports each new head to an auditor, which anchors it;
// the auditor fetches the chain now and then and checks every link. Midway an entry is
// tampered with, either edited in place or edited with every later link recomputed to hide it.

export interface MerkleResult {
  differing: number[];
  transferred: number[];
  rootsEqual: boolean;
  hashesCompared: number;
  tamperedAt: number;
  detectedAt: number;
  detectedTime: number;
  mode: string;
}

export const kernel: SystemsKernel<MerkleResult> = {
  params: [
    { kind: 'range', key: 'depth', label: 'Tree depth (2^depth blocks)', min: 2, max: 6, step: 1, value: 4, rebuild: true },
    { kind: 'range', key: 'changed', label: 'Blocks that differ', min: 0, max: 8, step: 1, value: 3, rebuild: true },
    {
      kind: 'select', key: 'tamper', label: 'Tampering', value: 'rewrite', rebuild: true,
      options: [
        { value: 'edit', label: 'Edit one entry' },
        { value: 'rewrite', label: 'Edit and recompute later links' },
        { value: 'none', label: 'None' },
      ],
    },
  ],
  setup: () => ({ lanes: ['replica A', 'replica B', 'auditor'], horizon: 5000, net: { delay: [8, 30] } }),
  install(net, p) {
    const depth = num(p, 'depth'); const n = 2 ** depth;
    const changed = Math.min(n, num(p, 'changed'));
    const mode = str(p, 'tamper');
    const word = () => Math.floor(net.rnd() * 2 ** 32);
    const blocksA = Array.from({ length: n }, () => Array.from({ length: 6 }, word));
    const blocksB = blocksA.map((b) => b.slice());
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(net.rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const differing = idx.slice(0, changed).sort((a, b) => a - b);
    for (const i of differing) blocksB[i][Math.floor(net.rnd() * 6)] ^= 1 << Math.floor(net.rnd() * 32);
    const treeA = M.build(blocksA);
    let treeB = M.build(blocksB);
    const res: MerkleResult = {
      differing, transferred: [], rootsEqual: false, hashesCompared: 0,
      tamperedAt: -1, detectedAt: -1, detectedTime: NaN, mode,
    };
    const top = treeA.length - 1;
    let outstanding = 0;
    const done = () => {
      if (outstanding) return;
      treeB = M.build(blocksB);
      res.rootsEqual = M.same(M.root(treeA), M.root(treeB));
      net.gauge('synced', net.now);
      net.mark(1, res.rootsEqual ? 'roots equal' : 'roots differ', 0.95);
      net.state(1, '');
    };
    // B asks A for the digest of node (level, i) and compares it with its own
    const ask = (level: number, i: number) => {
      outstanding++;
      net.send(1, 0, level === top ? 'root?' : `L${level}·${i}?`, () => {
        const d = treeA[level][i];
        net.send(0, 1, M.short(d), () => {
          outstanding--;
          res.hashesCompared++;
          net.count('hashes');
          if (!M.same(d, treeB[level][i])) {
            net.mark(1, level ? `≠L${level}·${i}` : `≠#${i}`, 0.3);
            if (level === 0) fetchBlock(i);
            else { ask(level - 1, 2 * i); ask(level - 1, 2 * i + 1); }
          }
          done();
        }, { reliable: true });
      }, { reliable: true });
    };
    const fetchBlock = (i: number) => {
      outstanding++;
      net.send(1, 0, `block ${i}?`, () => {
        const data = blocksA[i].slice();
        net.send(0, 1, `block ${i}`, () => {
          outstanding--;
          blocksB[i] = data;
          res.transferred.push(i);
          net.count('blocks');
          done();
        }, { reliable: true });
      }, { reliable: true });
    };
    net.state(1, 'repairing');
    net.after(20, () => ask(top, 0));

    // the hash chain and its auditor
    const chain: M.Link[] = [];
    const anchors = new Map<number, M.Digest>();
    const appendOne = () => {
      M.append(chain, Array.from({ length: 4 }, word));
      const i = chain.length - 1;
      const head = chain[i].hash;
      net.count('entries');
      net.mark(0, `e${i}`, 0.6);
      net.send(0, 2, `head ${i}`, () => { anchors.set(i, head); }, { reliable: true });
      net.after(net.uniform(120, 260), appendOne);
    };
    const auditOnce = () => {
      net.send(2, 0, 'chain?', () => {
        const copy = chain.map((l) => ({ payload: l.payload.slice(), hash: l.hash.slice() }));
        net.send(0, 2, `${copy.length} links`, () => {
          net.count('audits');
          const bad = M.audit(copy, anchors);
          if (bad >= 0 && res.detectedAt < 0) {
            res.detectedAt = bad;
            res.detectedTime = net.now;
            net.gauge('detected', bad);
            net.mark(2, `broken at e${bad}`, 0.05);
            net.state(2, 'alarm');
          } else if (bad < 0) net.mark(2, 'ok', 0.85);
        }, { reliable: true });
      }, { reliable: true });
      net.after(700, auditOnce);
    };
    net.after(30, appendOne);
    net.after(400, auditOnce);
    if (mode !== 'none') {
      net.at(net.horizon * 0.6, () => {
        if (chain.length < 3) return;
        const k = Math.floor(net.rnd() * (chain.length - 2));
        chain[k].payload[0] ^= 1;
        if (mode === 'rewrite') {
          for (let i = k; i < chain.length; i++) chain[i].hash = M.linkHash(i ? chain[i - 1].hash : null, chain[i].payload);
        }
        res.tamperedAt = k;
        net.gauge('tampered', k);
        net.mark(0, `tamper e${k}`, 0.05);
        net.state(0, 'tampered');
      });
    }
    return res;
  },
  readouts: [
    { key: 'hashes', label: 'Digests compared' },
    { key: 'blocks', label: 'Blocks transferred' },
    { key: 'synced', kind: 'gauge', label: 'Repair finished at', unit: ' ms' },
    { key: 'entries', label: 'Log entries' },
    { key: 'audits', label: 'Audits' },
    { key: 'tampered', kind: 'gauge', label: 'Entry tampered with' },
    { key: 'detected', kind: 'gauge', label: 'Audit found the break at entry' },
  ],
  verdict(r) {
    const repair = `${r.transferred.length} of ${r.differing.length} differing blocks sent, roots ${r.rootsEqual ? 'equal' : 'differ'}`;
    const audit = r.tamperedAt < 0 ? 'no tampering' : r.detectedAt >= 0
      ? `tamper at e${r.tamperedAt} found at e${r.detectedAt}` : `tamper at e${r.tamperedAt} not yet audited`;
    return `${repair}; ${audit}`;
  },
};
