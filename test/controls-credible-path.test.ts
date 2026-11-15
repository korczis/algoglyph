// credible-path's lowest link confidence becomes a control (wave 7a phase 2, C6): the graph
// engine drew each confidence of the links shape as round(30 + u · 69) / 100, 0.30 to 0.99; for a
// kernel that declares the control it now draws round(lo + u · (99 − lo)) / 100 with
// lo = 100 · minConfidence, the same single draw in the same place, so the default 0.30 is the old
// graph (test/controls-graph-engine.test.ts compares every plate with the old engine);
// spreading-activation also takes the links shape and, declaring no such control, keeps it.
// From 0.01 (c > 0 keeps −ln c finite) to 0.98 (c < 0.99, the top, keeps the draw's range non-
// empty): a meaning reason at each end, stated at the declaration.
// Checked here: the control exists with the old constant as its default, it travels in a shared
// link, it sets the confidences and nothing else, and it drives the readout: under the −ln c rule
// the plate's product of confidences is the largest product over all source–target paths at both
// ends, computed here by a Floyd–Warshall in the (max, ×) semiring over the confidences
// themselves (no logarithm, never the kernel's Dijkstra), printed to three digits.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import * as G from '../src/engines/graph';
import { makeGraph, type Graph } from '../src/engines/graph/graph';
import { defaultParams, type GraphKernel } from '../src/engines/graph/trace';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'credible-path';
const KEY = 'minConfidence';
const kernels = import.meta.glob<GraphKernel>('../src/kernels/graph/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => kernels[`../src/kernels/graph/${id}.ts`];
const kernel = kernelOf(ID);
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return G.engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel);
};
const SEED = 4242;
const defOf = () => kernel.params?.find((d) => d.key === KEY) as RangeParam | undefined;
type Input = { minConfidence?: number };
const linksAt = (n: number, seed: number, input?: Input) =>
  (makeGraph as (s: 'links', n: number, seed: number, a?: number, i?: Input) => Graph)('links', n, seed, 16 / 9, input);
const inputOf = (k: GraphKernel, p: Params): Input =>
  (G as unknown as { graphInput: (k: GraphKernel, p: Params) => Input }).graphInput(k, p);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, number | string> } });

/** The largest product of confidences over all s–t paths, by Floyd–Warshall in the (max, ×)
 * semiring: every confidence is below 1, so a product only falls along a path and the best walk
 * is a simple path. */
function largestProduct(g: Graph): number {
  const p = Array.from({ length: g.n }, (_, i) => Array.from({ length: g.n }, (_, j): number => (i === j ? 1 : 0)));
  for (let e = 0; e < g.m; e++) {
    const [u, v] = [g.eu[e], g.ev[e]];
    p[u][v] = Math.max(p[u][v], g.w[e]);
    p[v][u] = Math.max(p[v][u], g.w[e]);
  }
  for (let k = 0; k < g.n; k++) for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) {
    if (p[i][k] * p[k][j] > p[i][j]) p[i][j] = p[i][k] * p[k][j];
  }
  return p[g.s][g.t];
}

describe('credible-path: lowest link confidence', () => {
  it('is a range control, the old constant 0.30 its default', () => {
    expect(defOf()).toMatchObject({ kind: 'range', min: 0.01, max: 0.98, step: 0.01, value: 0.3, rebuild: true });
    expect(plate().params.find((x) => x.key === KEY)).toEqual(defOf());
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0.01, 0.57, 0.98]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7)), `${v}`).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('sets the confidences to lo..0.99 in hundredths and nothing else; spreading-activation keeps them', () => {
    expect(inputOf(kernel, { ...defaultParams(kernel), [KEY]: 0.5 })).toEqual({ minConfidence: 0.5 });
    expect(inputOf(kernelOf('spreading-activation'), defaultParams(kernelOf('spreading-activation')))).toEqual({});
    for (const c of [0.01, 0.1, 0.3, 0.57, 0.98]) {
      for (const n of [4, 90, 300]) {
        for (const seed of [1, 7, SEED]) {
          const g = linksAt(n, seed, { minConfidence: c });
          const base = linksAt(n, seed);
          expect({ ...g, w: [] }, `${n} ${seed}`).toEqual({ ...base, w: [] });
          for (const w of g.w) {
            expect(w).toBeGreaterThanOrEqual(c);
            expect(w).toBeLessThanOrEqual(0.99);
            expect(Math.round(w * 100) / 100).toBe(w);
          }
          if (c === 0.3) expect(g).toEqual(base);
        }
      }
    }
    expect(Math.min(...linksAt(300, SEED, { minConfidence: 0.01 }).w)).toBeLessThan(0.3);
  });

  it('drives the readout: the −ln c rule reaches the largest product at both ends', async () => {
    for (const c of [0.01, 0.98]) {
      const best = largestProduct(linksAt(kernel.n!.value, SEED, { minConfidence: c }));
      const r = await read(ID, claim('Product of confidences', { cost: 'log', [KEY]: c }));
      expect(r.reason, `${c}`).toBeUndefined();
      expect(r.value, `${c}`).toBe(Number(best.toPrecision(3)));
    }
  });
});
