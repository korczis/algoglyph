// Knapsack's capacity per item becomes a control (S5 C1). The capacity was W = round(2.5 n);
// now W = max(4, round(c n)) for the control c, whose default 2.5 is the old constant. Checked:
// the control exists, it travels in a shared link, it drives the table the plate fills (cells =
// (n + 1)(W + 1) exactly, best value = brute force over every subset), and every grid plate's
// default input, trace and controls are what they were before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/grid';
import { trace, type GridKernel } from '../src/engines/grid/trace';
import type { KnapsackData, KnapsackResult } from '../src/kernels/grid/knapsack-dp';
import { read } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const modules = import.meta.glob<GridKernel>('../src/kernels/grid/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => modules[`../src/kernels/grid/${id}.ts`];
const live = ENTRIES.filter((e) => e.engine === 'grid' && e.status === 'live');
const knapsack = kernelOf('knapsack-dp') as GridKernel<KnapsackData, KnapsackResult>;
const plateOf = (id: string) => {
  const e = live.find((x) => x.id === id)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const KEY = 'capacityPerItem';
/** The default run's seed in the plate and in every claim (src/core/claims.ts DEFAULT_SEED). */
const SEED = 4242;

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);

/** The oracle's capacity: the old floor of 4 kept, c n rounded half up. */
const capacity = (n: number, c: number) => Math.max(4, Math.round(n * c));

/** The best value of any subset of the items within capacity W, by enumerating all 2^n. */
function brute(weights: number[], values: number[], W: number): number {
  let best = 0;
  for (let mask = 0; mask < 1 << weights.length; mask++) {
    let w = 0; let v = 0;
    for (let i = 0; i < weights.length; i++) if (mask & (1 << i)) { w += weights[i]; v += values[i]; }
    if (w <= W && v > best) best = v;
  }
  return best;
}

/** Every control value the range offers, ends included. */
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);

const instanceAt = (n: number, seed: number, c: number) =>
  (knapsack.instance as (n: number, s: number, o: Record<string, number>) => ReturnType<typeof knapsack.instance>)(n, seed, { [KEY]: c });

describe('knapsack-dp: capacity per item', () => {
  it('is a range control with the old constant as its default', () => {
    const d = plateOf('knapsack-dp').params.find((x) => x.key === KEY);
    expect(d).toMatchObject({ kind: 'range', label: 'Capacity per item', min: 0.5, max: 2.5, step: 0.25, value: 2.5, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plateOf('knapsack-dp').params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const c of [0.5, 1.25, 1.75]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: c }, 7))).toEqual({ seed: 7, params: { [KEY]: c } });
    }
  });

  it('sets the table: (n + 1)(W + 1) cells, and the brute-force best value, at every setting', () => {
    const d = knapsack.params?.find((x) => x.key === KEY) as RangeParam | undefined;
    expect(d, 'the kernel declares the control').toBeDefined();
    for (const c of settings(d!)) {
      for (let n = knapsack.size.min; n <= knapsack.size.max; n++) {
        for (const seed of [1, 42, SEED]) {
          const inst = instanceAt(n, seed, c);
          const W = capacity(n, c);
          const t = trace(inst);
          expect(t.truncated).toBe(false);
          expect(inst.data.capacity, `n=${n} c=${c}`).toBe(W);
          expect(t.tally.computed, `n=${n} c=${c} seed=${seed}`).toBe((n + 1) * (W + 1));
          expect(t.outcome!.result.best, `n=${n} c=${c} seed=${seed}`).toBe(brute(inst.data.weights, inst.data.values, W));
        }
      }
    }
  }, 60_000);

  it('drives the plate\'s readouts', async () => {
    const n = knapsack.size.value;
    // the items do not depend on the capacity: the capacity draws no random number
    const { weights, values } = knapsack.instance(n, SEED).data;
    for (const c of [0.5, 1, 1.75]) {
      const W = capacity(n, c);
      const setup = { params: { [KEY]: c } };
      const cells = await read('knapsack-dp', { id: 'cells', statement: '', readout: 'Cells computed', expect: { value: 0 }, setup });
      expect(cells.reason).toBeUndefined();
      expect(cells.value, `c=${c}`).toBe((n + 1) * (W + 1));
      const best = await read('knapsack-dp', { id: 'best', statement: '', readout: 'Result', expect: { value: 0 }, setup });
      expect(best.reason).toBeUndefined();
      expect(best.value, `c=${c}`).toBe(brute(weights, values, W));
    }
  }, 60_000);
});

describe('the grid engine at the defaults is what it was before the control', () => {
  // recorded on the code before the control existed (main a1fc269)
  const TRACES = 'ba619e7bf097bc7e';
  const PARAMS = '92bbdd6f6e9b547a';
  const KNAPSACK_READOUTS = '98f231a043791dc9';

  it('every grid kernel draws the same input and records the same trace', () => {
    const ids = Object.keys(modules).sort();
    const all = ids.map((id) => {
      const k = modules[id];
      return [k.size.value, k.size.min].flatMap((n) => [1, SEED].map((seed) => {
        const inst = k.instance(n, seed);
        const t = trace(inst);
        return [id, n, seed, inst.rows, inst.cols, inst.input, inst.rowLabels, inst.colLabels, inst.data,
          hash(Array.from(t.events.subarray(0, 4 * t.length))), t.outcome?.summary];
      }));
    });
    expect(hash(all)).toBe(TRACES);
  }, 60_000);

  it('every grid plate offers the same controls, the new one aside', () => {
    const defs = live.map((e) => [e.id, plateOf(e.id).params.filter((d) => d.key !== KEY)]);
    expect(hash(defs)).toBe(PARAMS);
  });

  it('the knapsack plate reads the same at its defaults', async () => {
    const out: (string | undefined)[] = [];
    for (const readout of ['Cells computed', 'Subproblems reused (reads)', 'Comparisons', 'Traceback cells', 'Input', 'Result']) {
      out.push((await read('knapsack-dp', { id: 'x', statement: '', readout, expect: { value: 0 } })).text);
    }
    expect(hash(out), JSON.stringify(out)).toBe(KNAPSACK_READOUTS);
  }, 60_000);
});
