// bellman-ford's planted negative cycle gets a control for its edge weight (wave 7a phase 2, C5):
// the graph engine set the three edges of the cycle it plants in the negative-cycle shape to −40;
// for a kernel that declares the control it now sets them to `cycleWeight`, with no draw at all,
// so −40 is the old graph (test/controls-graph-engine.test.ts compares every plate with the old
// engine). From −90 to −1: three edges of weight w make a cycle of weight 3w, below 0 at every
// setting, so the input stays "with a negative cycle", and the cycle hangs off a vertex the
// source reaches (graph.ts), so no round of Bellman–Ford is ever the last to change nothing: it
// runs all n rounds whatever the weight.
// Checked here: the control exists with the old constant as its default, only on the
// negative-cycle input, it travels in a shared link, it sets the planted weights and nothing else,
// the planted cycle weighs 3w and is reachable (by a Floyd–Warshall written here), and the plate
// reads Rounds = n at both ends of the range.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import * as G from '../src/engines/graph';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, type GraphKernel } from '../src/engines/graph/trace';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'bellman-ford';
const KEY = 'cycleWeight';
const kernels = import.meta.glob<GraphKernel>('../src/kernels/graph/[!_]*.ts', { import: 'kernel', eager: true });
const kernel = kernels[`../src/kernels/graph/${ID}.ts`];
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return G.engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel);
};
const SEED = 4242;
const defOf = () => kernel.params?.find((d) => d.key === KEY) as RangeParam | undefined;
type Input = { cycleWeight?: number };
const graphAt = (shape: Shape, n: number, seed: number, input?: Input) =>
  (makeGraph as (s: Shape, n: number, seed: number, a?: number, i?: Input) => Graph)(shape, n, seed, 16 / 9, input);
const inputOf = (k: GraphKernel, p: Params): Input =>
  (G as unknown as { graphInput: (k: GraphKernel, p: Params) => Input }).graphInput(k, p);
const claim = (readout: string, params: Params, expect: Claim['expect'] = { range: [-1e12, 1e12] }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number | string> } });

/** All-pairs distances by Floyd–Warshall: the diagonal goes below 0 on a negative cycle. */
function floyd(g: Graph): number[][] {
  const d = Array.from({ length: g.n }, (_, i) => Array.from({ length: g.n }, (_, j) => (i === j ? 0 : Infinity)));
  for (let e = 0; e < g.m; e++) d[g.eu[e]][g.ev[e]] = Math.min(d[g.eu[e]][g.ev[e]], g.w[e]);
  for (let k = 0; k < g.n; k++) for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) {
    if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
  }
  return d;
}

describe('bellman-ford: the planted cycle\'s edge weight', () => {
  it('is a range control on the negative-cycle input only, the old constant −40 its default', () => {
    expect(defOf()).toMatchObject({
      kind: 'range', min: -90, max: -1, step: 1, value: -40, rebuild: true,
      when: { key: 'shape', values: ['negative-cycle'] },
    });
    expect(plate().params.find((x) => x.key === KEY)).toEqual(defOf());
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [-90, -10, -1]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7)), `${v}`).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('sets the three planted weights and nothing else; the cycle weighs 3w and is reachable', () => {
    expect(inputOf(kernel, { ...defaultParams(kernel), [KEY]: -5 })).toEqual({ cycleWeight: -5 });
    for (const w of [-90, -40, -7, -1]) {
      for (const n of [4, 60, 200]) {
        for (const seed of [1, 7, SEED]) {
          const g = graphAt('negative-cycle', n, seed, { cycleWeight: w });
          const base = graphAt('negative-cycle', n, seed);
          expect({ ...g, w: [] }, `${n} ${seed}`).toEqual({ ...base, w: [] });
          const moved = g.w.map((x, e) => [x, base.w[e]]).filter(([a, b]) => a !== b);
          for (const [a, b] of moved) { expect(a).toBe(w); expect(b).toBe(-40); }
          // the three planted edges (a → b → c → a, three distinct vertices) and no other
          if (w !== -40) expect(moved.length, `${n} ${seed}`).toBe(3);
          if (w === -40) expect(g).toEqual(base);
          const d = floyd(g);
          expect(d.some((row, i) => row[i] < 0 && Number.isFinite(d[g.s][i])), `${n} ${seed}: a reachable negative cycle`).toBe(true);
          for (const shape of ['signed', 'digraph', 'geometric'] as Shape[]) {
            expect(graphAt(shape, n, seed, { cycleWeight: w }), `${shape}`).toEqual(graphAt(shape, n, seed));
          }
        }
      }
    }
  });

  it('drives the readouts: Rounds = n at −1 and at −90, and the last round still changes', async () => {
    for (const w of [-1, -90]) {
      const r = await read(ID, claim('Rounds', { shape: 'negative-cycle', [KEY]: w }, { against: 'Graph', tolerance: 0 }));
      expect(r.reason, `${w}`).toBeUndefined();
      expect(r.value, `rounds − n at ${w}`).toBe(0);
      const c = await read(ID, claim('Change in the last round', { shape: 'negative-cycle', [KEY]: w }));
      expect(c.value!, `${w}`).toBeGreaterThan(0);
    }
  });
});
