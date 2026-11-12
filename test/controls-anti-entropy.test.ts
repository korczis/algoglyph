// The anti-entropy plate's constants become controls (S3 A1, A3). The shared network's partition
// healed at 0.6 of the run; now at the `heal` control's percentage (default 60, the old
// constant). Checked here: the control exists on this plate, it travels in a shared link, and it
// moves the partition window and the convergence the plate reads. The engine's defaults are
// guarded once for every systems kernel in test/controls-crdt-convergence.test.ts.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/systems';
import { defaultParams, simulate, total, type SystemsKernel } from '../src/engines/systems/sim';
import type { AntiEntropyResult } from '../src/kernels/systems/anti-entropy';
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
const ID = 'anti-entropy';
const HORIZON = 10000;
const SEEDS = [1, 2, 3, 5, 8, 13, 4242];

const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);
const defOf = (key: string) => plateOf(ID).params.find((x) => x.key === key) as RangeParam | undefined;
const claim = (readout: string, params: Params, expect: Claim['expect'] = { value: 0 }): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });

/** The run's own identities: no write received twice, and each write sent once to each replica
 * that lacked it, once the replicas have converged. */
function identities(r: AntiEntropyResult, label: string) {
  const R = r.written.length;
  const T = r.written.reduce((s, x) => s + x, 0);
  expect(r.duplicates, label).toBe(0);
  expect(r.gaps, label).toBe(0);
  if (!Number.isNaN(r.convergedAt)) expect(r.applied, label).toBe((R - 1) * T);
}

describe('anti-entropy: partition heals at', () => {
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

  it('ends the partition at heal × horizon, and nothing converges before it', () => {
    const d = defOf('heal');
    expect(d, 'the plate declares the control').toBeDefined();
    const k = kernelOf(ID) as SystemsKernel<AntiEntropyResult>;
    for (const heal of settings(d!)) for (const seed of SEEDS) {
      const { net, result } = simulate(k, defaultParams(k, { heal }), seed);
      const to = Math.round((HORIZON * heal) / 100);
      expect(net.cfg.partition, `heal ${heal}`).toEqual({ from: 3000, to, side: [0, 0, 1, 1] });
      // every replica writes at most 420 ms apart until 4,000 ms, so each side writes in
      // [3,000, 4,000) and nothing crosses before the partition heals: no replica holds every
      // write before max(heal, writes stop)
      identities(result, `heal ${heal} seed ${seed}`);
      if (!Number.isNaN(result.convergedAt)) {
        expect(result.convergedAt, `heal ${heal} seed ${seed}`).toBeGreaterThanOrEqual(Math.max(to, 4000));
      }
      expect(total(net, 'duplicates')).toBe(0);
    }
  });

  it('drives the plate\'s readout', async () => {
    for (const heal of [45, 80]) {
      const r = await read(ID, claim('Converged at', { heal }));
      expect(r.reason, `heal ${heal}`).toBeUndefined();
      expect(r.value!, `heal ${heal}`).toBeGreaterThanOrEqual(Math.max((HORIZON * heal) / 100, 4000));
      expect(r.value!, `heal ${heal}`).toBeLessThanOrEqual(HORIZON);
      const t = await read(ID, claim('Writes transferred', { heal }, { against: 'Result', against_number: 3, tolerance: 0 }));
      expect(t.reason, `heal ${heal}`).toBeUndefined();
      expect(t.value, `heal ${heal}: transfers − (replicas − 1) × writes`).toBe(0);
    }
  });
});

describe('anti-entropy: writes stop at', () => {
  it('is a range control of the plate, the old constant its default', () => {
    // up to 40: writing longer only adds writes and their transfers, and at 80% of the run the
    // trace is about 8% longer than at the plate's heaviest setting today (6 replicas, 5 ms
    // delay, no loss or partition); 35 is the least that still writes on both sides of the cut
    expect(defOf('writeStop')).toMatchObject({ kind: 'range', label: 'Writes stop at (% of run)', min: 35, max: 40, step: 5, value: 40, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plateOf(ID).params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    expect(parse(defs, serialise(defs, { ...d, writeStop: 35 }, 7))).toEqual({ seed: 7, params: { writeStop: 35 } });
  });

  it('stops the writes at writeStop × horizon, with no duplicate and every transfer exact', () => {
    const d = defOf('writeStop');
    expect(d, 'the plate declares the control').toBeDefined();
    const k = kernelOf(ID) as SystemsKernel<AntiEntropyResult>;
    for (const writeStop of settings(d!)) for (const heal of [40, 60, 90]) for (const seed of SEEDS) {
      for (const net of [{}, { delay: 120, loss: 40 }, { delay: 5, loss: 0, partition: false }] as Params[]) {
        const label = `writeStop ${writeStop} heal ${heal} seed ${seed} ${JSON.stringify(net)}`;
        const run = simulate(k, defaultParams(k, { ...net, writeStop, heal }), seed);
        const stop = (HORIZON * writeStop) / 100;
        const marks = run.net.events.filter((e) => e.k === 'mark' && /^w\d+$/.test(e.label));
        expect(Math.max(...marks.map((e) => (e as { t: number }).t)), label).toBeLessThanOrEqual(stop);
        identities(run.result, label);
        if (Number.isNaN(run.result.convergedAt)) continue;
        expect(run.result.convergedAt, label).toBeGreaterThan(stop);
        // each side writes in [3,000, stop), longer than the 420 ms between writes
        if (run.net.cfg.partition) {
          expect(run.result.convergedAt, label).toBeGreaterThanOrEqual(Math.max(stop, (HORIZON * heal) / 100));
        }
      }
    }
  });

  it('drives the plate\'s readouts', async () => {
    const r = await read(ID, claim('Converged at', { writeStop: 35, heal: 40 }));
    expect(r.reason).toBeUndefined();
    expect(r.value!).toBeGreaterThanOrEqual(4000);
    const t = await read(ID, claim('Writes transferred', { writeStop: 35 }, { against: 'Result', against_number: 3, tolerance: 0 }));
    expect(t.reason).toBeUndefined();
    expect(t.value, 'transfers − (replicas − 1) × writes').toBe(0);
    const w35 = await read(ID, claim('Writes', { writeStop: 35 }));
    const w40 = await read(ID, claim('Writes', {}));
    // each of the 4 replicas writes from within 150 ms every 120 to 420 ms: by 3,500 ms at least
    // 1 + ⌊3,350 / 420⌋ = 8 and at most 1 + ⌊3,500 / 120⌋ = 30 writes
    expect(w35.value!).toBeGreaterThanOrEqual(32);
    expect(w35.value!).toBeLessThanOrEqual(120);
    expect(w35.value!, 'stopping earlier never adds writes on the same seed').toBeLessThanOrEqual(w40.value!);
  });
});
