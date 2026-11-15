// The random input's edges per vertex become a control of connected-components,
// articulation-points and bridges (wave 7b, C2): the graph engine drew round(1.2 · n) distinct
// pairs (at most n(n − 1)/2); for a kernel that declares `edgesPerVertex` (GraphInput /
// INPUT_KEYS) it draws round(edgesPerVertex · n), so the default 1.2 is the old graph
// (test/controls-graph-engine.test.ts compares every plate with the old engine). The rejection
// loop draws the same pairs in the same order and each weight just after its pair, so the edge
// list at a lower setting is a prefix of the list at a higher one; only the draws after the edges
// (the vertex weights) shift off the default.
// Checked here: the control exists with the old constant as its default, on the random input
// only, it travels in a shared link, it sets the edge count and nothing else, the prefix, and it
// drives the readouts, each against an oracle written here: Components is the count of an
// independent breadth-first labelling across the range and never below n − m (each edge joins
// at most two components); Articulation points and Bridges are what removing each vertex or
// edge in turn does to that count.
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

const kernels = import.meta.glob<GraphKernel>('../src/kernels/graph/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => kernels[`../src/kernels/graph/${id}.ts`];
const plateOf = (id: string) => {
  const e = ENTRIES.find((x) => x.id === id)!;
  return G.engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const KEY = 'edgesPerVertex';
const PLATES = ['connected-components', 'articulation-points', 'bridges'];
const SEED = 4242;
const ASPECT = 16 / 9;
const defOf = (id: string) => kernelOf(id).params?.find((d) => d.key === KEY) as RangeParam | undefined;
type Input = { edgesPerVertex?: number };
const graphAt = (shape: Shape, n: number, seed: number, input?: Input) =>
  (makeGraph as (s: Shape, n: number, seed: number, a?: number, i?: Input) => Graph)(shape, n, seed, ASPECT, input);
const inputOf = (k: GraphKernel, p: Params): Input =>
  (G as unknown as { graphInput: (k: GraphKernel, p: Params) => Input }).graphInput(k, p);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, number | string> } });
/** Every setting of the slider, as its own step count gives it (0.1 to 3 in tenths). */
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 },
  (_, i) => Math.round((d.min + i * d.step) * 10) / 10);

/** Components by breadth-first labelling over the edge list, skipping vertex `cutV` and edge
 * `cutE` (−1: none). */
function components(g: Graph, cutV = -1, cutE = -1): number {
  const next: number[][] = Array.from({ length: g.n }, () => []);
  for (let e = 0; e < g.m; e++) {
    if (e === cutE || g.eu[e] === cutV || g.ev[e] === cutV) continue;
    next[g.eu[e]].push(g.ev[e]); next[g.ev[e]].push(g.eu[e]);
  }
  const seen = new Array<boolean>(g.n).fill(false);
  let c = 0;
  for (let s = 0; s < g.n; s++) {
    if (s === cutV || seen[s]) continue;
    c++;
    seen[s] = true;
    const queue = [s];
    for (let i = 0; i < queue.length; i++) for (const v of next[queue[i]]) if (!seen[v]) { seen[v] = true; queue.push(v); }
  }
  return c;
}

/** Cut vertices by brute removal: v (with an edge) separates when G − v has more components. */
function cutVertices(g: Graph): number {
  const c = components(g);
  let k = 0;
  for (let v = 0; v < g.n; v++) {
    const deg = Array.from({ length: g.m }, (_, e) => g.eu[e] === v || g.ev[e] === v).filter(Boolean).length;
    if (deg > 0 && components(g, v) > c) k++;
  }
  return k;
}

/** Bridges by brute removal: e is a bridge when G − e has more components. */
function bridges(g: Graph): number {
  const c = components(g);
  return Array.from({ length: g.m }, (_, e) => components(g, -1, e) > c).filter(Boolean).length;
}

describe('connected components, articulation points and bridges: edges per vertex', () => {
  it('is a range control on the random input only, the old constant 1.2 its default', () => {
    for (const id of PLATES) {
      expect(defOf(id), id).toMatchObject({
        kind: 'range', label: 'Edges per vertex', min: 0.1, max: 3, step: 0.1, value: 1.2, rebuild: true,
        when: { key: 'shape', values: ['random'] },
      });
      expect(defOf(id)!.hint, id).toBeTruthy();
      expect(kernelOf(id).inputs, id).toContain('random');
      expect(plateOf(id).params.find((x) => x.key === KEY), id).toEqual(defOf(id));
    }
  });

  it('round-trips through a shared link', () => {
    for (const id of PLATES) {
      const defs = plateOf(id).params;
      const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
      for (const v of [0.1, 2, 3]) {
        expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7)), `${id} ${v}`).toEqual({ seed: 7, params: { [KEY]: v } });
      }
    }
  });

  it('sets the random input\'s edge count, a prefix of the list at any higher setting', () => {
    for (const id of PLATES) expect(inputOf(kernelOf(id), { ...defaultParams(kernelOf(id)), [KEY]: 2 }), id).toEqual({ edgesPerVertex: 2 });
    const all = settings(defOf('connected-components')!);
    expect(all[0]).toBe(0.1);
    expect(all[all.length - 1]).toBe(3);
    for (const n of [6, 8, 70, 110, 300, 400]) {
      for (const seed of [1, 7, SEED]) {
        const base = graphAt('random', n, seed);
        expect(graphAt('random', n, seed, { edgesPerVertex: 1.2 }), `n ${n} seed ${seed}`).toEqual(base);
        let lower: Graph | null = null;
        for (const k of all) {
          const g = graphAt('random', n, seed, { edgesPerVertex: k });
          expect(g.m, `n ${n} seed ${seed} at ${k}`).toBe(Math.min((n * (n - 1)) / 2, Math.round(k * n)));
          expect([g.n, g.x, g.y, g.s, g.t]).toEqual([base.n, base.x, base.y, base.s, base.t]);
          if (lower) {
            // the same pairs in the same order with the same weights, then the new ones
            expect(g.eu.slice(0, lower.m), `n ${n} seed ${seed} ${k}`).toEqual(lower.eu);
            expect(g.ev.slice(0, lower.m), `n ${n} seed ${seed} ${k}`).toEqual(lower.ev);
            expect(g.w.slice(0, lower.m), `n ${n} seed ${seed} ${k}`).toEqual(lower.w);
          }
          lower = g;
        }
        // the other shapes draw as they did whatever the control says
        for (const shape of ['geometric', 'grid', 'islands', 'small-world'] as Shape[]) {
          expect(graphAt(shape, n, seed, { edgesPerVertex: 3 }), `${shape} n ${n} seed ${seed}`).toEqual(graphAt(shape, n, seed));
        }
      }
    }
  });

  it('drives the readouts: Components by BFS and at least n − m; cut vertices and bridges by removal', async () => {
    const cc = kernelOf('connected-components').n!.value;
    const counts: number[] = [];
    for (const k of settings(defOf('connected-components')!)) {
      const g = graphAt('random', cc, SEED, { edgesPerVertex: k });
      const c = components(g);
      counts.push(c);
      expect(c, `at ${k}: each edge joins at most two components`).toBeGreaterThanOrEqual(g.n - g.m);
      const r = await read('connected-components', claim('Components', { shape: 'random', [KEY]: k }));
      expect(r.reason, `at ${k}`).toBeUndefined();
      expect(r.value, `Components at ${k}`).toBe(c);
    }
    // a prefix only ever joins components: the count never rises with the setting
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    expect(counts[0]).toBeGreaterThan(counts[counts.length - 1]);
    for (const k of [0.1, 1.2, 3]) {
      const ap = kernelOf('articulation-points').n!.value;
      const g = graphAt('random', ap, SEED, { edgesPerVertex: k });
      const cut = await read('articulation-points', claim('Articulation points', { shape: 'random', [KEY]: k }));
      expect(cut.reason).toBeUndefined();
      expect(cut.value, `cut vertices at ${k}`).toBe(cutVertices(g));
      const br = await read('bridges', claim('Bridges', { shape: 'random', [KEY]: k }));
      expect(br.reason).toBeUndefined();
      expect(br.value, `bridges at ${k}`).toBe(bridges(graphAt('random', kernelOf('bridges').n!.value, SEED, { edgesPerVertex: k })));
    }
  }, 600_000);
});
