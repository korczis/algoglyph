// The Raft plate's constants become controls (S3 A1, A4). The shared network's partition healed
// at 0.6 of the run; now at the `heal` control's percentage (default 60, the old constant).
// Checked here: the control exists on this plate, it travels in a shared link, and it moves the
// partition window while election safety holds at every setting. The engine's defaults are
// guarded once for every systems kernel in test/controls-crdt-convergence.test.ts.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/systems';
import { defaultParams, simulate, type SystemsKernel } from '../src/engines/systems/sim';
import type { RaftResult } from '../src/kernels/systems/raft-election';
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
const ID = 'raft-election';
const HORIZON = 6000;
const SEEDS = [1, 2, 3, 5, 8, 13, 4242];

const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);
const defOf = (key: string) => plateOf(ID).params.find((x) => x.key === key) as RangeParam | undefined;
const claim = (readout: string, params: Params, expect: Claim['expect'] = { value: 0 }): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });

/** Election safety, from the run's record: at most one leader per term, each elected by a
 * majority of distinct voters that granted it their one vote of that term. */
function safe(r: RaftResult, label: string) {
  const byTerm = new Map<number, Set<number>>();
  for (const l of r.leaders) {
    if (!byTerm.has(l.term)) byTerm.set(l.term, new Set());
    byTerm.get(l.term)!.add(l.node);
    expect(new Set(l.votes).size, label).toBeGreaterThanOrEqual(Math.floor(r.n / 2) + 1);
  }
  for (const [t, s] of byTerm) expect(s.size, `${label} term ${t}`).toBe(1);
  const voted = new Map<string, number>();
  for (const v of r.votes) {
    const key = `${v.term}:${v.voter}`;
    expect(voted.get(key) ?? v.candidate, `${label}: one vote per node per term`).toBe(v.candidate);
    voted.set(key, v.candidate);
  }
}

describe('raft-election: partition heals at', () => {
  it('is the shared network\'s range control, the old constant its default', () => {
    expect(defOf('heal')).toMatchObject({ kind: 'range', label: 'Partition heals at (% of run)', min: 40, max: 90, step: 5, value: 60, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plateOf(ID).params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [40, 45, 75, 90]) {
      expect(parse(defs, serialise(defs, { ...d, heal: v }, 7))).toEqual({ seed: 7, params: { heal: v } });
    }
  });

  it('ends the partition at heal × horizon, with one leader per term at every setting', () => {
    const d = defOf('heal');
    expect(d, 'the plate declares the control').toBeDefined();
    const k = kernelOf(ID) as SystemsKernel<RaftResult>;
    for (const heal of settings(d!)) for (const seed of SEEDS) {
      const { net, result } = simulate(k, defaultParams(k, { heal }), seed);
      expect(net.cfg.partition, `heal ${heal}`).toEqual({ from: 1800, to: Math.round((HORIZON * heal) / 100), side: [0, 0, 1, 1, 1] });
      safe(result, `heal ${heal} seed ${seed}`);
    }
  });

  it('drives the plate\'s readout', async () => {
    for (const heal of [40, 90]) {
      const r = await read(ID, claim('Result', { heal }, { against: 'Leaders elected', tolerance: 0 }));
      expect(r.reason, `heal ${heal}`).toBeUndefined();
      expect(r.value, `heal ${heal}: terms that elected a leader − leaders elected`).toBe(0);
    }
  });
});

describe('raft-election: election timeout up to', () => {
  it('is a range control of the plate, the old constant its default', () => {
    // from 300: a shorter top means more elections, each n² messages, and a heavier trace than
    // the plate's heaviest setting today; a longer one only means fewer elections
    expect(defOf('timeoutMax')).toMatchObject({ kind: 'range', label: 'Election timeout up to (ms)', min: 300, max: 900, step: 10, value: 300, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plateOf(ID).params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [310, 450, 600, 900]) {
      expect(parse(defs, serialise(defs, { ...d, timeoutMax: v }, 7))).toEqual({ seed: 7, params: { timeoutMax: v } });
    }
  });

  it('draws the first timeout in [150, timeoutMax), with one leader per term at every setting', () => {
    const d = defOf('timeoutMax');
    expect(d, 'the plate declares the control').toBeDefined();
    const k = kernelOf(ID) as SystemsKernel<RaftResult>;
    for (const timeoutMax of [300, 310, 450, 600, 750, 900]) for (const seed of SEEDS) {
      for (const net of [{}, { delay: 120, loss: 40 }, { delay: 5, loss: 0, partition: false }] as Params[]) {
        const label = `timeoutMax ${timeoutMax} seed ${seed} ${JSON.stringify(net)}`;
        const { net: tr, result } = simulate(k, defaultParams(k, { ...net, timeoutMax }), seed);
        // every node's timer starts at 0, so the first candidacy is the least of n draws in
        // [150, timeoutMax): nothing else makes a node stand
        const first = tr.events.find((e) => e.k === 'mark' && /^T\d+\?$/.test(e.label)) as { t: number } | undefined;
        expect(first, label).toBeDefined();
        expect(first!.t, label).toBeGreaterThanOrEqual(150);
        expect(first!.t, label).toBeLessThan(timeoutMax);
        safe(result, label);
      }
    }
  });

  it('drives the plate\'s readouts', async () => {
    for (const timeoutMax of [600, 900]) {
      const r = await read(ID, claim('Result', { timeoutMax }, { against: 'Leaders elected', tolerance: 0 }));
      expect(r.reason, `timeoutMax ${timeoutMax}`).toBeUndefined();
      expect(r.value, `timeoutMax ${timeoutMax}: terms that elected a leader − leaders elected`).toBe(0);
    }
  });
});
