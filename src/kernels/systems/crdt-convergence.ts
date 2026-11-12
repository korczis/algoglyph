import { num } from '../../core/plate';
import type { SystemsKernel } from '../../engines/systems/sim';
import * as C from './_crdt';

// Replicas accept writes locally at any time, partition or not: counter increments and
// decrements, adds and removes of labels in a shared set. Every so often a replica sends its
// whole state to a random peer, which merges it. Writes stop before the end, at the writeStop
// control's share of the run, so the run shows the replicas converging once the partition has
// healed and the gossip has caught up.
const LABELS = ['alpha', 'beta', 'gamma', 'delta', 'omega', 'sigma'];

export type Op =
  | { kind: 'inc'; replica: number; by: number }
  | { kind: 'add'; replica: number; element: string; tag: string }
  | { kind: 'remove'; replica: number; element: string; tags: string[] };

export interface CrdtResult {
  replicas: C.Replica[];
  ops: Op[];
  /** Time the replicas first agreed after the writes stopped (NaN when they never did). */
  convergedAt: number;
  lastWrite: number;
}

export const kernel: SystemsKernel<CrdtResult> = {
  network: true,
  params: [
    { kind: 'range', key: 'replicas', label: 'Replicas', min: 2, max: 6, step: 1, value: 4, rebuild: true },
    // at most 55: writing longer only adds writes, and the run was already at its heaviest
    { kind: 'range', key: 'writeStop', label: 'Writes stop at (% of run)', min: 35, max: 55, step: 5, value: 55, rebuild: true },
  ],
  setup: (p) => ({
    lanes: Array.from({ length: num(p, 'replicas') }, (_, i) => `replica ${String.fromCharCode(65 + i)}`),
    horizon: 6000,
  }),
  install(net, p) {
    const R = num(p, 'replicas');
    const reps = Array.from({ length: R }, () => C.empty(R));
    const ops: Op[] = [];
    const res: CrdtResult = { replicas: reps, ops, convergedAt: NaN, lastWrite: 0 };
    let tags = 0;
    // (writeStop / 100) first: 55 / 100 is the double 0.55, so the default stops where it did
    const writeUntil = net.horizon * (Number(p.writeStop ?? 55) / 100);
    const write = (i: number) => {
      if (net.now > writeUntil) return;
      const s = reps[i];
      const u = net.rnd();
      if (u < 0.4) {
        const by = net.rnd() < 0.7 ? 1 : -1;
        C.increment(s, i, by);
        ops.push({ kind: 'inc', replica: i, by });
        net.mark(i, by > 0 ? '+1' : '−1', 0.55);
      } else {
        const element = LABELS[Math.floor(net.rnd() * LABELS.length)];
        const present = C.elements(s).includes(element);
        if (u < 0.75 || !present) {
          const tag = `${i}.${tags++}`;
          C.add(s, element, tag);
          ops.push({ kind: 'add', replica: i, element, tag });
          net.mark(i, `+${element}`, 0.8);
        } else {
          ops.push({ kind: 'remove', replica: i, element, tags: C.remove(s, element) });
          net.mark(i, `−${element}`, 0.3);
        }
      }
      net.count('writes');
      res.lastWrite = net.now;
      net.after(net.uniform(80, 320), () => write(i));
    };
    const gossip = (i: number) => {
      if (R > 1) {
        let j = Math.floor(net.rnd() * (R - 1));
        if (j >= i) j++;
        const snapshot = C.clone(reps[i]);
        net.send(i, j, 'state', () => {
          const back = C.merge(reps[j], snapshot);
          net.count('merges');
          if (back.length) {
            net.count('conflicts', back.length);
            net.mark(j, `add wins: ${back.join(',')}`, 0.95);
          }
        });
      }
      net.after(net.uniform(90, 210), () => gossip(i));
    };
    let converged = false;
    const watch = () => {
      const codes = new Set(reps.map(C.encode));
      net.sample('distinct replica states', codes.size);
      const values = reps.map(C.value);
      net.sample('counter spread', Math.max(...values) - Math.min(...values));
      // equal states while writes still arrive are a coincidence (every replica starts empty);
      // convergence is the first moment they agree once the writes have stopped
      if (codes.size === 1 && !converged && net.now > writeUntil) {
        converged = true;
        res.convergedAt = net.now;
        net.gauge('converged', net.now);
      } else if (codes.size > 1) {
        converged = false;
        res.convergedAt = NaN;
      }
      net.after(25, watch);
    };
    for (let i = 0; i < R; i++) {
      net.state(i, 'writing');
      net.after(net.uniform(0, 200), () => write(i));
      net.after(net.uniform(0, 200), () => gossip(i));
    }
    net.at(writeUntil, () => { for (let i = 0; i < R; i++) net.state(i, 'gossip only'); });
    net.after(0, watch);
    return res;
  },
  readouts: [
    { key: 'writes', label: 'Writes accepted' },
    { key: 'merges', label: 'States merged' },
    { key: 'conflicts', label: 'Concurrent add/remove resolved (add wins)' },
    { key: 'converged', kind: 'gauge', label: 'Converged at', unit: ' ms' },
  ],
  chart: { title: 'Divergence between replicas', y: 'count' },
  verdict(r) {
    const codes = new Set(r.replicas.map(C.encode));
    if (codes.size > 1) return `${codes.size} distinct states left at the end`;
    const sum = r.ops.reduce((s, o) => s + (o.kind === 'inc' ? o.by : 0), 0);
    const v = C.value(r.replicas[0]);
    return `converged: counter ${v} (sum of writes ${sum}), set {${C.elements(r.replicas[0]).join(', ')}}`;
  },
};
