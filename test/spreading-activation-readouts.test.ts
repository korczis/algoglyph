// spreading-activation's readouts (wave 7b).
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, other, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace, type GraphKernel } from '../src/engines/graph/trace';
import { kernel, type ActivationResult } from '../src/kernels/graph/spreading-activation';
import { repeatedLabels, settledRows } from './support/digraph-oracles';
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
