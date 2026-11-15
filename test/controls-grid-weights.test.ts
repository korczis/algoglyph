// The grid's and the small world's largest edge weight becomes a control of the spanning-tree
// plates and Dijkstra (wave 7a phase 2, C3): the graph engine drew every weight of those two
// shapes as int(1, 9); for a kernel that declares the control it now draws int(1, maxWeight), the
// same single draw in the same place, so the default 9 is the old graph
// (test/controls-graph-engine.test.ts compares every plate with the old engine). The random
// shape keeps its 1..99 whatever the control says.
// Checked here: the control exists with the old constant as its default, only on those two
// inputs, it travels in a shared link, it sets the weights and nothing else, and it drives the
// readouts: at 1 every spanning tree weighs its edge count, V − 1 on the connected grid, so
// Kruskal, Prim and Borůvka all read V − 1; and Dijkstra reduces to breadth-first search, its
// farthest settled distance the grid's hop eccentricity from the corner s = 0, rows + cols − 2.
// At 99 the tree weight is dense Prim's (test/support/graph-oracles.ts) and Dijkstra's farthest
// is an independent Bellman–Ford's.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import * as G from '../src/engines/graph';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, type GraphKernel } from '../src/engines/graph/trace';
import { read, type Claim } from './support/claims';
import { densePrim } from './support/graph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const kernels = import.meta.glob<GraphKernel>('../src/kernels/graph/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => kernels[`../src/kernels/graph/${id}.ts`];
const plateOf = (id: string) => {
  const e = ENTRIES.find((x) => x.id === id)!;
  return G.engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const KEY = 'maxWeight';
const MST = ['kruskal-mst', 'prim-mst', 'boruvka-mst'];
const PLATES = [...MST, 'dijkstra'];
const SEED = 4242;
const ASPECT = 16 / 9;
const WEIGHT = 'Weight of the tree edges';
const defOf = (id: string) => kernelOf(id).params?.find((d) => d.key === KEY) as RangeParam | undefined;
type Input = { maxWeight?: number };
const graphAt = (shape: Shape, n: number, seed: number, input?: Input) =>
  (makeGraph as (s: Shape, n: number, seed: number, a?: number, i?: Input) => Graph)(shape, n, seed, ASPECT, input);
const inputOf = (k: GraphKernel, p: Params): Input =>
  (G as unknown as { graphInput: (k: GraphKernel, p: Params) => Input }).graphInput(k, p);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, number | string> } });

/** The grid's rows and columns as graph.ts lays them out for n at this aspect. */
function gridShape(n: number): { rows: number; cols: number } {
  const cols = Math.max(2, Math.round(Math.sqrt(n * ASPECT)));
  return { rows: Math.max(2, Math.round(n / cols)), cols };
}

/** Single-source distances by Bellman–Ford over both directions of every edge (not Dijkstra). */
function bellmanFord(g: Graph, s: number): number[] {
  const d = new Array<number>(g.n).fill(Infinity);
  d[s] = 0;
  for (let round = 0; round < g.n; round++) {
    let changed = false;
    for (let e = 0; e < g.m; e++) {
      const [u, v, w] = [g.eu[e], g.ev[e], g.w[e]];
      if (d[u] + w < d[v]) { d[v] = d[u] + w; changed = true; }
      if (d[v] + w < d[u]) { d[u] = d[v] + w; changed = true; }
    }
    if (!changed) break;
  }
  return d;
}

describe('spanning trees and Dijkstra: largest weight of the grid and the small world', () => {
  it('is a range control on those two inputs only, the old constant 9 its default', () => {
    for (const id of PLATES) {
      expect(defOf(id), id).toMatchObject({
        kind: 'range', min: 1, max: 99, step: 1, value: 9, rebuild: true,
        when: { key: 'shape', values: ['grid', 'small-world'] },
      });
      expect(plateOf(id).params.find((x) => x.key === KEY), id).toEqual(defOf(id));
    }
  });

  it('round-trips through a shared link', () => {
    for (const id of PLATES) {
      const defs = plateOf(id).params;
      const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
      for (const v of [1, 50, 99]) {
        expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7)), `${id} ${v}`).toEqual({ seed: 7, params: { [KEY]: v } });
      }
    }
  });

  it('sets the grid and small-world weights to 1..maxWeight and nothing else', () => {
    for (const id of PLATES) expect(inputOf(kernelOf(id), { ...defaultParams(kernelOf(id)), [KEY]: 3 }), id).toEqual({ maxWeight: 3 });
    for (const W of [1, 2, 9, 50, 99]) {
      for (const n of [4, 60, 120, 400]) {
        for (const seed of [1, 7, SEED]) {
          for (const shape of ['grid', 'small-world'] as Shape[]) {
            const g = graphAt(shape, n, seed, { maxWeight: W });
            const base = graphAt(shape, n, seed);
            expect({ ...g, w: [] }, `${shape} ${n} ${seed}`).toEqual({ ...base, w: [] });
            for (const w of g.w) { expect(w).toBeGreaterThanOrEqual(1); expect(w).toBeLessThanOrEqual(W); }
            if (W === 9) expect(g).toEqual(base);
          }
          for (const shape of ['random', 'geometric'] as Shape[]) {
            expect(graphAt(shape, n, seed, { maxWeight: W }), `${shape} ${n} ${seed}`).toEqual(graphAt(shape, n, seed));
          }
        }
      }
    }
    expect(Math.max(...graphAt('grid', 400, SEED, { maxWeight: 99 }).w)).toBeGreaterThan(9);
  });

  it('drives the readouts: at 1 the tree weighs V − 1 and Dijkstra\'s farthest is rows + cols − 2', async () => {
    const n = kernelOf('kruskal-mst').n!.value;
    for (const shape of ['grid', 'small-world'] as Shape[]) {
      const g = graphAt(shape, n, SEED, { maxWeight: 1 });
      // connected (dense Prim finds one tree), so a spanning tree has V − 1 edges of weight 1
      expect(densePrim(g).trees, shape).toBe(1);
      for (const id of MST) {
        const r = await read(id, claim(WEIGHT, { shape, [KEY]: 1 }));
        expect(r.reason, id).toBeUndefined();
        expect(r.value, `${id} ${shape}`).toBe(g.n - 1);
        const top = graphAt(shape, n, SEED, { maxWeight: 99 });
        expect((await read(id, claim(WEIGHT, { shape, [KEY]: 99 }))).value, `${id} ${shape} at 99`).toBe(densePrim(top).weight);
      }
    }
    const dn = kernelOf('dijkstra').n!.value;
    const { rows, cols } = gridShape(dn);
    const unit = graphAt('grid', dn, SEED, { maxWeight: 1 });
    expect(unit.n).toBe(rows * cols);
    const far = await read('dijkstra', claim('Farthest settled', { shape: 'grid', [KEY]: 1 }));
    expect(far.reason).toBeUndefined();
    expect(far.value, 'rows + cols − 2').toBe(rows + cols - 2);
    const top = graphAt('grid', dn, SEED, { maxWeight: 99 });
    const ref = Math.max(...bellmanFord(top, top.s).filter(Number.isFinite));
    expect((await read('dijkstra', claim('Farthest settled', { shape: 'grid', [KEY]: 99 }))).value).toBe(ref);
  });
});
