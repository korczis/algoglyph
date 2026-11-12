// The CRDT plate's constants become controls (S3 A1, A2). The shared network's partition healed
// at 0.6 of the run (src/engines/systems/sim.ts); now at the `heal` control's percentage, whose
// default 60 is the old constant, on every plate that uses the network controls and on the
// replication lab. Checked here: the control exists with its range, it travels in a shared link,
// it moves the partition window and the convergence the plate reads, and every systems kernel
// records the same trace at its defaults as the old network did (rule 10, within one run).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/systems';
import { defaultParams, Net, NET_PARAMS, simulate, type NetConfig, type Setup,
  type SystemsKernel } from '../src/engines/systems/sim';
import * as C from '../src/kernels/systems/_crdt';
import type { CrdtResult } from '../src/kernels/systems/crdt-convergence';
import { loadLab } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const modules = import.meta.glob<SystemsKernel>('../src/kernels/systems/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => modules[`../src/kernels/systems/${id}.ts`];
const live = ENTRIES.filter((e) => e.engine === 'systems' && e.status === 'live');
const plateOf = (id: string) => {
  const e = live.find((x) => x.id === id)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const ID = 'crdt-convergence';
const HORIZON = 6000;
const SEEDS = [1, 2, 3, 5, 8, 13, 4242];

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);
const defOf = (key: string) => plateOf(ID).params.find((x) => x.key === key) as RangeParam | undefined;
const claim = (readout: string, params: Params, expect: Claim['expect'] = { value: 0 }): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });
const sumOfWrites = (r: CrdtResult) => r.ops.reduce((s, o) => s + (o.kind === 'inc' ? o.by : 0), 0);

describe('crdt-convergence: partition heals at', () => {
  it('is a range control of the shared network, the old constant its default', async () => {
    const want = { kind: 'range', key: 'heal', label: 'Partition heals at (% of run)', min: 40, max: 90, step: 5, value: 60, rebuild: true };
    expect(NET_PARAMS.find((d) => d.key === 'heal')).toMatchObject(want);
    expect(defOf('heal')).toMatchObject(want);
    const lab = await loadLab('replication');
    expect(lab?.params.find((d) => d.key === 'heal'), 'the replication lab shares it').toMatchObject(want);
  });

  it('round-trips through a shared link, on the plate and the lab', async () => {
    const lab = await loadLab('replication');
    for (const defs of [plateOf(ID).params, lab!.params]) {
      const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
      for (const v of [40, 45, 75, 90]) {
        expect(parse(defs, serialise(defs, { ...d, heal: v }, 7))).toEqual({ seed: 7, params: { heal: v } });
      }
    }
  });

  it('ends the partition at heal × horizon, and the replicas converge only after it', () => {
    const d = defOf('heal');
    expect(d, 'the plate declares the control').toBeDefined();
    const k = kernelOf(ID) as SystemsKernel<CrdtResult>;
    for (const heal of settings(d!)) for (const seed of SEEDS) {
      const { net, result } = simulate(k, defaultParams(k, { heal }), seed);
      const to = Math.round((HORIZON * heal) / 100);
      expect(net.cfg.partition, `heal ${heal}`).toEqual({ from: 1800, to, side: [0, 0, 1, 1] });
      // every replica writes at most 320 ms apart until 3,300 ms, so each side writes in
      // [1,800, 2,400) at the least, and nothing crosses before the partition heals: the sides
      // differ until then, and the replicas cannot agree before max(heal, writes stop)
      if (!Number.isNaN(result.convergedAt)) {
        expect(result.convergedAt, `heal ${heal} seed ${seed}`).toBeGreaterThanOrEqual(Math.max(to, 3300));
        expect(C.value(result.replicas[0])).toBe(sumOfWrites(result));
      }
    }
  });

  it('drives the plate\'s readout', async () => {
    for (const heal of [45, 80]) {
      const r = await read(ID, claim('Converged at', { heal }));
      expect(r.reason, `heal ${heal}`).toBeUndefined();
      expect(r.value!, `heal ${heal}`).toBeGreaterThanOrEqual(Math.max((HORIZON * heal) / 100, 3300));
      expect(r.value!, `heal ${heal}`).toBeLessThanOrEqual(HORIZON);
    }
  });
});

describe('crdt-convergence: writes stop at', () => {
  it('is a range control of the plate, the old constant its default', () => {
    // up to 55: writing longer adds writes and their marks, and at 80% of the run the trace is
    // about 7% longer than at the plate's heaviest setting today (6 replicas, no partition)
    expect(defOf('writeStop')).toMatchObject({ kind: 'range', label: 'Writes stop at (% of run)', min: 35, max: 55, step: 5, value: 55, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plateOf(ID).params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [35, 40, 45, 50]) {
      expect(parse(defs, serialise(defs, { ...d, writeStop: v }, 7))).toEqual({ seed: 7, params: { writeStop: v } });
    }
  });

  it('stops the writes at writeStop × horizon; the counter converges to their sum, after max(heal, writeStop)', () => {
    const d = defOf('writeStop');
    expect(d, 'the plate declares the control').toBeDefined();
    const k = kernelOf(ID) as SystemsKernel<CrdtResult>;
    for (const writeStop of settings(d!)) for (const heal of [40, 60, 90]) for (const seed of SEEDS) {
      const label = `writeStop ${writeStop} heal ${heal} seed ${seed}`;
      const { net, result } = simulate(k, defaultParams(k, { writeStop, heal }), seed);
      const stop = (HORIZON * writeStop) / 100;
      expect(result.lastWrite, label).toBeLessThanOrEqual(stop);
      // a replica writes at most 320 ms apart, so the last write falls within 320 ms of the stop
      expect(result.lastWrite, label).toBeGreaterThan(stop - 320);
      expect(result.ops.length, label).toBe(net.events.filter((e) => e.k === 'count' && e.key === 'writes').length);
      if (Number.isNaN(result.convergedAt)) continue;
      expect(C.value(result.replicas[0]), label).toBe(sumOfWrites(result));
      expect(result.convergedAt, label).toBeGreaterThan(stop);
      // each side writes inside the cut [1,800, min(heal, stop)) when that window is longer than
      // the 320 ms between writes, and then the sides differ until the partition heals
      if (Math.min((HORIZON * heal) / 100, stop) - 1800 > 320) {
        expect(result.convergedAt, label).toBeGreaterThanOrEqual((HORIZON * heal) / 100);
      }
    }
  });

  it('drives the plate\'s readouts', async () => {
    for (const writeStop of [35, 45]) {
      const r = await read(ID, claim('Converged at', { writeStop }));
      expect(r.reason, `writeStop ${writeStop}`).toBeUndefined();
      // at 45 each side writes in [1,800, 2,700), longer than 320 ms, so the default heal at
      // 3,600 ms bounds it; at 35 the window is 300 ms and only the stop at 2,100 ms does
      const stop = (HORIZON * writeStop) / 100;
      expect(r.value!, `writeStop ${writeStop}`).toBeGreaterThan(stop - 1800 > 320 ? Math.max(3600, stop) : stop);
      const v = await read(ID, claim('Result', { writeStop }, { against: 'Result', against_number: 2, tolerance: 0 }));
      expect(v.reason, `writeStop ${writeStop}`).toBeUndefined();
      expect(v.value, `writeStop ${writeStop}: counter − sum of writes`).toBe(0);
    }
  });
});

// ---- the engine at the defaults ---------------------------------------------------------------

/** Every key a control of S3 A added; a run without them takes the old constants. */
const NEW_KEYS = ['heal', 'writeStop', 'timeoutMax', 'ttl'];

/** The network as it was before the controls (main 23b65ad): the partition from 0.3 to 0.6. */
function oldNetConfig(k: SystemsKernel, s: Setup, p: Params): NetConfig {
  const base: NetConfig = { delay: [5, 40], loss: 0, partition: null, ...s.net };
  if (!k.network) return base;
  const dmax = Number(p.delay ?? 40);
  const half = Math.floor(s.lanes.length / 2);
  const side = s.side ?? s.lanes.map((_, i) => (i < half ? 0 : 1));
  return {
    delay: [Math.max(1, dmax / 8), dmax],
    loss: Number(p.loss ?? 0) / 100,
    partition: p.partition === true
      ? { from: Math.round(s.horizon * 0.3), to: Math.round(s.horizon * 0.6), side } : null,
  };
}

function oldRun(k: SystemsKernel, p: Params, seed: number) {
  const s = k.setup(p);
  const net = new Net(s.lanes, oldNetConfig(k, s, p), seed, s.horizon);
  const result = k.install(net, p);
  net.run();
  return { events: net.events, stamps: net.stamps, result };
}

const NETS: Params[] = [
  {},
  { delay: 40, loss: 0, partition: false },
  { delay: 100, loss: 25, partition: true },
  { delay: 10, loss: 40, partition: false },
];

describe('the systems engine at its defaults is what it was before the controls', () => {
  it('every systems kernel records the same trace with the new controls at their defaults as the old network and constants gave', () => {
    for (const [path, k] of Object.entries(modules)) {
      for (const over of k.network ? NETS : [{}]) for (const seed of [1, 7, 4242]) {
        const p = defaultParams(k, over);
        const without: Params = Object.fromEntries(Object.entries(p).filter(([key]) => !NEW_KEYS.includes(key)));
        const now = simulate(k, p, seed);
        const old = oldRun(k, without, seed);
        expect(now.net.events.length, `${path} ${JSON.stringify(over)} seed ${seed}`).toBe(old.events.length);
        expect(now.net.events, `${path} ${JSON.stringify(over)} seed ${seed}`).toEqual(old.events);
        expect(now.net.stamps).toEqual(old.stamps);
      }
    }
  }, 120_000);

  // recorded on the code before the controls existed (main 23b65ad); the kernels named below draw
  // only uniform numbers through + and ×, so their traces are the same on every IEEE machine
  const TRACES = 'af51513572bbe7f9';
  it('the replication and lease plates draw the same numbers in the same order as before', () => {
    const out = ['crdt-convergence', 'anti-entropy', 'raft-election', 'lease-fencing'].map((id) => {
      const k = kernelOf(id);
      return (k.network ? NETS : [{}]).flatMap((over) => [1, 4242].map((seed) => {
        const { net } = simulate(k, defaultParams(k, over), seed);
        return [id, seed, net.events.length, hash(net.events)];
      }));
    });
    expect(hash(out), JSON.stringify(out)).toBe(TRACES);
  });

  const PARAMS = 'c3a4924a76a8eb05';
  it('the replication and lease plates and the replication lab offer the same controls, the new ones aside', async () => {
    const mine = ['anti-entropy', 'crdt-convergence', 'lease-fencing', 'raft-election'];
    const defs = mine.map((id) => [id, plateOf(id).params.filter((d) => !NEW_KEYS.includes(d.key))]);
    const lab = await loadLab('replication');
    expect(hash([defs, lab!.params.filter((d) => !NEW_KEYS.includes(d.key))])).toBe(PARAMS);
  });
});
