// spreading-activation's readouts (wave 7b).
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, other, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, EVENT_CAP, trace, type GraphKernel } from '../src/engines/graph/trace';
import { kernel, type ActivationResult } from '../src/kernels/graph/spreading-activation';
import { repeatedLabels, settledRows, settledRowsWith } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'spreading-activation';

// D1: the engine's done readout is labelled "Activated" (the kernel's names.done), and the
// kernel's own report added a second row with the same label: a claim reads only the first row
// with its label, so a settled plate's labels must be unique. The engine's row stays (the
// replay's count of settled vertices); the report row is renamed "Reach and firings".
const SETTINGS: [string, Record<string, unknown>][] = [
  ['communities', {}], ['links', { shape: 'links' }], ['threshold 0', { threshold: 0 }],
  ['decay 0.1, threshold 50', { decay: 0.1, threshold: 50 }],
];

describe('spreading-activation: a settled plate publishes each readout label once (D1)', () => {
  for (const [what, set] of SETTINGS) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const rows = await settledRows(ID, set as never, seed);
      expect(repeatedLabels(rows), rows.map((r) => r.label).join(' | ')).toEqual([]);
      expect(rows.map((r) => r.label)).toContain('Activated');
      expect(rows.map((r) => r.label)).toContain('Reach and firings');
    });
  }
});

// D2: at threshold 0 every recipient of a pulse fires again, so each round re-discovers it and the
// run leaves by its 1e-13 cut (or its 10000-round cap) with the last recipients still on the
// frontier: the plate read "Firing: 80" and "Activated: 0 of 80". A run that leaves that way
// now settles every vertex still holding a pulse.
function run(g: Graph, p: Record<string, number | string>, seed: number) {
  return trace(kernel, g, { s: g.s, t: g.t, p: { ...defaultParams(kernel), ...p } }, seed);
}

describe('spreading-activation at threshold 0 ends with nothing firing (D2)', () => {
  for (const seed of [DEFAULT_SEED, 7]) {
    it(`the default input, seed ${seed}`, async () => {
      const rows = await settledRows(ID, { threshold: 0 } as never, seed);
      const g = makeGraph(kernel.inputs[0], Number(kernel.n?.value), seed, 16 / 9);
      const r = run(g, { threshold: 0 }, seed).result as ActivationResult;
      const reached = r.act.filter((x) => x > 0).length;
      expect(reached, 'the default input is connected').toBe(g.n);
      const read = (label: string) => rows.find((x) => x.label === label)?.value;
      expect(read('Firing')).toBe('0');
      expect(read('Activated')).toBe(`${g.n} of ${g.n}`);
    });
  }
});

// The kernel's run before D2, verbatim but for the result type: a default run leaves by
// !firing, never by the cut or the cap, so the fix must leave every default run's events
// identical. Compared within one run, against this copy; no recorded hash.
const before: GraphKernel<ActivationResult> = {
  ...kernel,
  *steps(ops, { s, p }) {
    const g = ops.g;
    const d = Number(p.decay);
    const th = Number(p.threshold) / 1000;
    const strength = new Array<number>(g.n).fill(0);
    for (let e = 0; e < g.m; e++) { strength[g.eu[e]] += g.w[e]; if (!g.directed) strength[g.ev[e]] += g.w[e]; }
    const act = new Array<number>(g.n).fill(0);
    let pulse = new Array<number>(g.n).fill(0);
    pulse[s] = 1; act[s] = 1;
    ops.value(s, 1);
    ops.discover(s);
    let pulses = 0;
    for (let round = 0; round < 10000; round++) {
      const next = new Array<number>(g.n).fill(0);
      let firing = false;
      for (let u = 0; u < g.n; u++) {
        if (pulse[u] <= 0) continue;
        if (pulse[u] < th || !strength[u]) { if (act[u] > 0) ops.settle(u); continue; }
        yield;
        firing = true;
        pulses++;
        for (const e of g.out[u]) {
          ops.scan(e);
          next[other(g, e, u)] += (d * pulse[u] * g.w[e]) / strength[u];
        }
        ops.settle(u);
        yield;
      }
      if (!firing) break;
      let biggest = 0;
      for (let v = 0; v < g.n; v++) {
        if (!next[v]) continue;
        act[v] += next[v];
        biggest = Math.max(biggest, next[v]);
        ops.value(v, act[v]);
        if (next[v] >= th) ops.discover(v);
      }
      pulse = next;
      ops.round();
      yield;
      if (biggest < 1e-13) break;
    }
    return { act, pulses };
  },
};

describe('spreading-activation: a run that ends by itself is unchanged by D2', () => {
  const sizes = [kernel.n?.min, kernel.n?.value, kernel.n?.max].map(Number);
  for (const shape of kernel.inputs) for (const n of sizes) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${shape}, n ${n}, seed ${seed}: the same events, counts and result`, () => {
      const g = makeGraph(shape as Shape, n, seed, 16 / 9);
      const opts = { s: g.s, t: g.t, p: defaultParams(kernel) };
      const now = trace(kernel, g, opts, seed);
      const then = trace(before, g, opts, seed);
      expect(now.truncated).toBe(false);
      expect(now.length).toBe(then.length);
      expect(now.events).toEqual(then.events);
      expect(now.counts).toEqual(then.counts);
      expect(now.result).toEqual(then.result);
      expect(kernel.report?.(now.result as ActivationResult, g, opts))
        .toEqual(before.report?.(then.result as ActivationResult, g, opts));
    });
  }
});

// D3: a kernel that is not mayStop must finish at its controls' extremes (trace.ts). At threshold
// 0 a round scans every edge twice while the pulse mass falls only by d a round, so the decay's
// upper end sets the run's length: at n 300 it truncated 19 of 20 runs at decay 0.95.
describe('spreading-activation finishes at its own extreme (D3)', () => {
  const decay = kernel.params?.find((d) => d.key === 'decay');
  const top = decay?.kind === 'range' ? decay.max : NaN;
  const n = Number(kernel.n?.max);
  for (const shape of kernel.inputs) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${shape}, n ${n}, decay ${top}, threshold 0, seed ${seed}: not stopped at the event cap`, () => {
      expect(kernel.mayStop).toBeFalsy();
      const g = makeGraph(shape as Shape, n, seed, 16 / 9);
      const t = trace(kernel, g, { s: g.s, t: g.t, p: { decay: top, threshold: 0 } }, seed,
        EVENT_CAP, false);
      expect(t.truncated, `${t.length} events`).toBe(false);
    });
  }
});

// G2. Every round a vertex holding a pulse at or above the threshold passes on exactly d of it,
// so at threshold 0 the pulse mass is d^k in round k and the total activation is the geometric
// series 1 + d + d^2 + ... = 1 / (1 - d), whatever the graph; above it pulses only die, so the
// total falls short of that. The expectation is the series, never the plate's run. The readout
// is the engine's sum of the values written, printed to four significant figures.
const TOTAL = 'Total activation';
const series = (d: number) => 1 / (1 - d);
const halfUnit = (x: number) => 0.5 * 10 ** (Math.floor(Math.log10(x)) - 3);
const totalOf = (r: ActivationResult) => r.act.reduce((a, x) => a + x, 0);

describe('spreading-activation reads its total activation (G2)', () => {
  const decay = kernel.params?.find((d) => d.key === 'decay');
  const top = decay?.kind === 'range' ? decay.max : NaN;
  const dflt = Number(decay?.value);
  const AT_ZERO: [string, Record<string, unknown>][] = [
    ...kernel.inputs.map((shape): [string, Record<string, unknown>] => [shape, { shape }]),
    ['decay 0.1', { decay: 0.1 }], [`decay ${top}`, { decay: top }],
    [`decay ${top} at ${kernel.n?.max}`, { decay: top, n: kernel.n?.max }],
  ];
  for (const [what, set] of AT_ZERO) for (const seed of [DEFAULT_SEED, 7]) {
    it(`threshold 0, ${what}, seed ${seed}: 1 / (1 - d)`, async () => {
      const d = Number(set.decay ?? dflt);
      const rows = await settledRows(ID, { ...set, threshold: 0 } as never, seed);
      expect(repeatedLabels(rows), rows.map((r) => r.label).join(' | ')).toEqual([]);
      const row = rows.find((r) => r.label === TOTAL);
      expect(row, rows.map((r) => r.label).join(' | ')).toBeDefined();
      expect(Math.abs(Number(row?.value) - series(d)), `${row?.value} against ${series(d)}`)
        .toBeLessThanOrEqual(halfUnit(series(d)) * (1 + 1e-9));
      const g = makeGraph((set.shape ?? kernel.inputs[0]) as Shape, Number(set.n ?? kernel.n?.value),
        seed, 16 / 9);
      const r = run(g, { ...set, threshold: 0 } as never, seed).result as ActivationResult;
      expect(Math.abs(totalOf(r) - series(d))).toBeLessThanOrEqual(1e-9);
    });
  }

  for (const shape of kernel.inputs) for (const seed of [DEFAULT_SEED, 7]) {
    it(`the default threshold, ${shape}, seed ${seed}: below 1 / (1 - d)`, async () => {
      const rows = await settledRows(ID, { shape } as never, seed);
      const row = rows.find((r) => r.label === TOTAL);
      expect(row, rows.map((r) => r.label).join(' | ')).toBeDefined();
      expect(Number(row?.value)).toBeLessThan(series(dflt));
      const g = makeGraph(shape as Shape, Number(kernel.n?.value), seed, 16 / 9);
      expect(totalOf(run(g, {}, seed).result as ActivationResult)).toBeLessThan(series(dflt));
    });
  }
});

// The new row is readout-only: the kernel without it, run in the same plate, publishes every
// other row exactly as the kernel with it does, within one run.
const base: GraphKernel<ActivationResult> = {
  ...kernel,
  names: { ...kernel.names, total: undefined },
  readouts: kernel.readouts?.filter((k) => k !== 'total'),
};

describe('spreading-activation: the total is the only row that changes', () => {
  const SET: [string, Record<string, unknown>][] = [
    ['communities', {}], ['links', { shape: 'links' }], ['threshold 0', { threshold: 0 }],
  ];
  for (const [what, set] of SET) for (const seed of [DEFAULT_SEED, 7]) {
    it(`${what}, seed ${seed}`, async () => {
      const now = await settledRows(ID, set as never, seed);
      const then = await settledRowsWith(ID, base as GraphKernel, set as never, seed);
      expect(now.filter((r) => r.label !== TOTAL)).toEqual(then);
      expect(now.length).toBe(then.length + 1);
    });
  }
});
