// Where sugiyama-layout's claims get their figures (catalogue/entries/sugiyama-layout.md, read by
// test/claims.test.ts and here through the same instrument). Every expectation is computed in
// this file from the graph's edge lists, never read from the kernel: acyclicity by Kahn's
// algorithm (repeatedly remove a vertex with no edge in), the cycles broken by reversing the
// back edges of a recursive depth-first search (roots in vertex order, each vertex's edges in
// list order, as the kernel's note describes), the layers by the longest path into each vertex,
// memoised, the dummy nodes as sum (span - 1), and the crossings before the sweeps as inversions:
// each layer gap's segments sorted by their upper end (ties by the lower), then the pairs whose
// lower ends come in the opposite order, counted by merge sort. The crossings after the sweeps
// are not claimed: "after <= before" holds by construction (the best order starts at the
// initial one) and a strict improvement is empirical (integrator decision e).
import { describe, expect, it } from 'vitest';
import { claimSeeds, type Claim } from '../src/core/claims';
import { makeGraph, type Graph } from '../src/engines/graph/graph';
import { defaultParams, trace, type GraphKernel } from '../src/engines/graph/trace';
import { kernel as sugiyama } from '../src/kernels/graph/sugiyama-layout';
import { failures } from './support/claims';
import { claimGraph, entryClaims } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'sugiyama-layout';
const kernel = sugiyama as GraphKernel;
const ASPECT = 16 / 9;
const claims = entryClaims(ID) as unknown as Claim[];
const claimOf = (id: string): Claim => {
  const c = claims.find((x) => x.id === id);
  expect(c, `${ID} claim ${id}`).toBeDefined();
  return c!;
};
const graphAt = (c: Claim, seed: number): Graph =>
  claimGraph(kernel, { ...c, setup: { params: c.setup?.params, seed } } as never);

async function onThePlate(c: Claim) {
  expect(await failures(ID, c), `${ID} claim ${c.id}`).toEqual([]);
}

/** Whether Kahn's algorithm removes every vertex of these arcs: no directed cycle. */
function acyclic(n: number, arcs: [number, number][]): boolean {
  const indeg = new Array<number>(n).fill(0);
  for (const [, b] of arcs) indeg[b]++;
  const ready = Array.from({ length: n }, (_, v) => v).filter((v) => indeg[v] === 0);
  let removed = 0;
  while (ready.length) {
    const u = ready.pop()!;
    removed++;
    for (const [a, b] of arcs) if (a === u && --indeg[b] === 0) ready.push(b);
  }
  return removed === n;
}

const arcsOf = (g: Graph): [number, number][] =>
  Array.from({ length: g.m }, (_, e) => [g.eu[e], g.ev[e]] as [number, number]);

/** The edges a recursive depth-first search finds pointing back to a vertex on its path. */
function backEdges(g: Graph): Set<number> {
  const state = new Array<number>(g.n).fill(0);
  const back = new Set<number>();
  const visit = (u: number) => {
    state[u] = 1;
    for (const e of g.out[u]) {
      const v = g.ev[e];
      if (state[v] === 1) back.add(e);
      else if (state[v] === 0) visit(v);
    }
    state[u] = 2;
  };
  for (let r = 0; r < g.n; r++) if (!state[r]) visit(r);
  return back;
}

/** Every edge but a loop, in edge order, with the back edges reversed, and the longest-path
 * layer of every vertex. */
function layering(g: Graph) {
  const back = backEdges(g);
  const arcs: [number, number][] = [];
  for (let e = 0; e < g.m; e++) {
    if (g.eu[e] === g.ev[e]) continue;
    arcs.push(back.has(e) ? [g.ev[e], g.eu[e]] : [g.eu[e], g.ev[e]]);
  }
  expect(acyclic(g.n, arcs), 'reversing the back edges leaves a DAG').toBe(true);
  const into: number[][] = Array.from({ length: g.n }, () => []);
  for (const [a, b] of arcs) into[b].push(a);
  const layer = new Array<number>(g.n).fill(-1);
  const depth = (v: number): number => {
    if (layer[v] < 0) layer[v] = Math.max(0, ...into[v].map((u) => depth(u) + 1));
    return layer[v];
  };
  for (let v = 0; v < g.n; v++) depth(v);
  return { back, arcs, layer };
}

/** Inversions of a sequence, by merge sort: the pairs i < j with a[i] > a[j]. */
function inversions(a: number[]): number {
  if (a.length < 2) return 0;
  const mid = a.length >> 1;
  const l = a.slice(0, mid); const r = a.slice(mid);
  let count = inversions(l) + inversions(r);
  let i = 0; let j = 0; let k = 0;
  while (i < l.length && j < r.length) {
    if (l[i] <= r[j]) a[k++] = l[i++];
    else { a[k++] = r[j++]; count += l.length - i; }
  }
  while (i < l.length) a[k++] = l[i++];
  while (j < r.length) a[k++] = r[j++];
  return count;
}

/** The crossings of the initial layered drawing: dummy nodes created edge by edge, each layer in
 * node order (the graph's vertices, then the dummies as created). */
function initialCrossings(g: Graph): number {
  const { arcs, layer } = layering(g);
  const nodeLayer = layer.slice();
  const segs: [number, number][] = [];
  for (const [from, to] of arcs) {
    let a = from;
    for (let l = layer[from] + 1; l < layer[to]; l++) { nodeLayer.push(l); segs.push([a, nodeLayer.length - 1]); a = nodeLayer.length - 1; }
    segs.push([a, to]);
  }
  const pos = new Array<number>(nodeLayer.length);
  const filled = new Map<number, number>();
  nodeLayer.forEach((l, v) => { pos[v] = filled.get(l) ?? 0; filled.set(l, pos[v] + 1); });
  let total = 0;
  for (const l of filled.keys()) {
    const gap = segs.filter(([a]) => nodeLayer[a] === l).map(([a, b]) => [pos[a], pos[b]]);
    gap.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    total += inversions(gap.map((s) => s[1]));
  }
  return total;
}

describe('sugiyama-layout: the claims’ figures, computed here', () => {
  it('the layers are the longest path plus one', async () => {
    for (const id of ['layers-are-the-longest-path-plus-one', 'layers-on-the-reasoning-input',
      'layers-on-the-ownership-input']) {
      const c = claimOf(id);
      for (const seed of claimSeeds(c)) {
        const { layer } = layering(graphAt(c, seed));
        expect(c.expect.value, `${id} seed ${seed}`).toBe(Math.max(...layer) + 1);
      }
      await onThePlate(c);
    }
  });

  it('nothing is reversed on an acyclic input, something on one with a cycle', async () => {
    for (const id of ['no-edge-reversed-on-a-dag', 'no-edge-reversed-at-no-cross-holdings']) {
      const c = claimOf(id);
      for (const seed of claimSeeds(c)) {
        const g = graphAt(c, seed);
        expect(acyclic(g.n, arcsOf(g)), `${id} seed ${seed}`).toBe(true);
        expect(backEdges(g).size).toBe(0);
      }
      expect(c.expect, id).toEqual({ value: 0 });
      await onThePlate(c);
    }
    for (const id of ['a-cycle-is-broken-on-the-ownership-input', 'a-cycle-is-broken-at-the-most-cross-holdings']) {
      const c = claimOf(id);
      for (const seed of claimSeeds(c)) {
        const g = graphAt(c, seed);
        expect(acyclic(g.n, arcsOf(g)), `${id} seed ${seed}`).toBe(false);
      }
      expect(c.expect, id).toEqual({ above: 0 });
      await onThePlate(c);
    }
  });

  it('no edge points against the layer order', async () => {
    for (const id of ['no-edge-against-the-layer-order', 'no-edge-against-the-layer-order-on-the-ownership-input',
      'no-edge-against-the-layer-order-at-the-most-cross-holdings']) {
      const c = claimOf(id);
      for (const seed of claimSeeds(c)) {
        const { arcs, layer } = layering(graphAt(c, seed));
        expect(arcs.filter(([a, b]) => layer[b] <= layer[a]).length, `${id} seed ${seed}`).toBe(c.expect.value);
      }
      await onThePlate(c);
    }
  });

  it('the dummy nodes are the spans less one', async () => {
    for (const id of ['dummy-nodes-are-the-spans-less-one', 'dummy-nodes-at-seed-7']) {
      const c = claimOf(id);
      const { arcs, layer } = layering(graphAt(c, claimSeeds(c)[0]));
      expect(c.expect.value, id).toBe(arcs.reduce((s, [a, b]) => s + layer[b] - layer[a] - 1, 0));
      await onThePlate(c);
    }
  });

  it('the crossings before the sweeps are the initial drawing’s inversions', async () => {
    for (const id of ['crossings-before-the-sweeps', 'crossings-before-the-sweeps-at-seed-7',
      'crossings-before-the-sweeps-on-the-ownership-input']) {
      const c = claimOf(id);
      expect(c.expect.value, id).toBe(initialCrossings(graphAt(c, claimSeeds(c)[0])));
      await onThePlate(c);
    }
  });

  it('every edge is examined twice', async () => {
    for (const id of ['every-edge-examined-twice', 'every-edge-examined-twice-on-the-ownership-input']) {
      const c = claimOf(id);
      const g = graphAt(c, claimSeeds(c)[0]);
      expect(arcsOf(g).filter(([a, b]) => a === b)).toEqual([]);
      expect(c.expect.value, id).toBe(2 * g.m);
      await onThePlate(c);
    }
  });
});

describe('sugiyama-layout: the bounds, 2m − ℓ edges examined for ℓ loops', () => {
  for (const shape of kernel.inputs) {
    it(`counts them on the ${shape} input`, () => {
      for (const n of [4, 40, 160]) for (const seed of [4242, 7]) for (const crossHoldings of [0, 1, 12]) {
        const p = { ...defaultParams(kernel), crossHoldings };
        const g = makeGraph(shape, n, seed, ASPECT, shape === 'ownership' ? { crossHoldings } : {});
        const loops = arcsOf(g).filter(([a, b]) => a === b).length;
        expect(loops, `${shape} n ${n}`).toBe(0);
        const t = trace(kernel, g, { s: g.s, t: g.t, p }, seed);
        expect(t.counts.scans, `${shape} n ${n} seed ${seed}`).toBe(2 * g.m - loops);
      }
    });
  }
});
