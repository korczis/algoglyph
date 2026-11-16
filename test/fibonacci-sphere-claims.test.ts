// Where fibonacci-sphere's claims get their figures (catalogue/entries/fibonacci-sphere.md, read
// by test/claims.test.ts and here through the same instrument). Every expectation is computed in
// this file, never read from the kernel: the lattice from its formula (height 1 - (2i + 1)/n, a
// turn of the golden angle pi (3 - sqrt 5) per point), the placement order by a breadth-first
// search written here (sources: the plate's source, then every vertex in index order not yet
// reached), the grid's edges from its rows and columns, and the counts from the edge lists. The
// graph is the plate's own input at the claim's seed (makeGraph at 16:9, its own input controls).
import { describe, expect, it } from 'vitest';
import { claimSeeds, type Claim } from '../src/core/claims';
import { makeGraph, type Graph } from '../src/engines/graph/graph';
import { defaultParams, trace, type GraphKernel } from '../src/engines/graph/trace';
import { kernel as sphere } from '../src/kernels/graph/fibonacci-sphere';
import { failures } from './support/claims';
import { claimGraph, entryClaims } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'fibonacci-sphere';
const kernel = sphere as GraphKernel;
const ASPECT = 16 / 9;
const claims = entryClaims(ID) as unknown as Claim[];
const claimOf = (id: string): Claim => {
  const c = claims.find((x) => x.id === id);
  expect(c, `${ID} claim ${id}`).toBeDefined();
  return c!;
};
/** The claim's graph at one of its seeds. */
const graphAt = (c: Claim, seed: number): Graph =>
  claimGraph(kernel, { ...c, setup: { params: c.setup?.params, seed } } as never);

function lattice(n: number): [number, number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const h = 1 - (2 * i + 1) / n;
    const r = Math.sqrt(1 - h * h);
    const turn = i * Math.PI * (3 - Math.sqrt(5));
    return [r * Math.cos(turn), h, r * Math.sin(turn)];
  });
}

const chord = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The mean chord over the lattice's n(n - 1)/2 pairs of distinct points. */
function latticeMean(n: number): number {
  const p = lattice(n);
  let sum = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) sum += chord(p[i], p[j]);
  return sum / ((n * (n - 1)) / 2);
}

/** The lattice index each vertex takes: breadth-first from s, then from every vertex not yet
 * reached in index order, a vertex numbered when it is first seen. */
function bfsSlots(g: Graph, s: number): number[] {
  const slot = new Array<number>(g.n).fill(-1);
  let next = 0;
  for (const root of [s, ...Array.from({ length: g.n }, (_, i) => i)]) {
    if (slot[root] >= 0) continue;
    slot[root] = next++;
    const queue = [root];
    while (queue.length) {
      const u = queue.shift()!;
      for (const e of g.out[u]) {
        const v = g.eu[e] === u ? g.ev[e] : g.eu[e];
        if (slot[v] < 0) { slot[v] = next++; queue.push(v); }
      }
    }
  }
  return slot;
}

function meanEdgeChord(g: Graph): number {
  const p = lattice(g.n);
  const slot = bfsSlots(g, g.s);
  let sum = 0;
  for (let e = 0; e < g.m; e++) sum += chord(p[slot[g.eu[e]]], p[slot[g.ev[e]]]);
  return sum / g.m;
}

/** A value as the plate shows it, at three decimals; refused when it sits so near a rounding
 * boundary that the order of a sum could move it. */
function threeDecimals(x: number): number {
  const scaled = x * 1000;
  expect(Math.abs(scaled - Math.floor(scaled) - 0.5), `${x} is not near a rounding boundary`)
    .toBeGreaterThan(1e-6);
  return Number(x.toFixed(3));
}

/** The claim holds on the plate at every seed it lists, read by the instrument. */
async function onThePlate(c: Claim) {
  expect(await failures(ID, c), `${ID} claim ${c.id}`).toEqual([]);
}

describe('fibonacci-sphere: the claims’ figures, computed here', () => {
  it('the random-assignment baselines are the lattice’s mean pairwise chord', async () => {
    for (const id of ['random-assignment-baseline', 'random-assignment-baseline-on-8-points',
      'random-assignment-baseline-on-4-points']) {
      const c = claimOf(id);
      for (const seed of claimSeeds(c)) {
        expect(c.expect.value, `${id} seed ${seed}`).toBe(threeDecimals(latticeMean(graphAt(c, seed).n)));
      }
      await onThePlate(c);
    }
    // 8 points sit well above the continuum's 4/3; the edge chord claimed there lies between
    expect(claimOf('random-assignment-baseline-on-8-points').expect.value).toBeGreaterThan(4 / 3);
  });

  it('the mean edge chords are the breadth-first assignment’s', async () => {
    for (const id of ['mean-edge-chord', 'mean-edge-chord-at-seed-7', 'mean-edge-chord-on-8-points']) {
      const c = claimOf(id);
      const g = graphAt(c, claimSeeds(c)[0]);
      expect(g.shape).toBe('small-world');
      expect(c.expect.value, id).toBe(threeDecimals(meanEdgeChord(g)));
      await onThePlate(c);
    }
    const eight = meanEdgeChord(graphAt(claimOf('mean-edge-chord-on-8-points'), 4242));
    expect(eight).toBeGreaterThan(4 / 3);
    expect(eight).toBeLessThan(latticeMean(8));
  });

  it('the edges examined are the edge lists’ total, twice the edges', async () => {
    const c = claimOf('every-edge-examined-twice');
    for (const seed of claimSeeds(c)) {
      const g = graphAt(c, seed);
      expect(g.m, `seed ${seed}`).toBe(2 * g.n);
      const lists = g.out.reduce((s, l) => s + l.length, 0);
      expect(lists).toBe(2 * g.m);
      expect(c.expect.value, `seed ${seed}`).toBe(lists);
    }
    await onThePlate(c);
  });

  it('the grid’s edges follow from its rows and columns', async () => {
    const c = claimOf('every-edge-examined-twice-on-the-grid');
    const g = graphAt(c, 4242);
    const cols = Math.max(2, Math.round(Math.sqrt(160 * ASPECT)));
    const rows = Math.max(2, Math.round(160 / cols));
    expect([cols, rows]).toEqual([17, 9]);
    const m = rows * (cols - 1) + (rows - 1) * cols;
    expect([g.n, g.m]).toEqual([rows * cols, m]);
    expect(c.expect.value).toBe(2 * m);
    await onThePlate(c);
  });

  it('every vertex is placed once, on a connected input or not', async () => {
    for (const id of ['every-vertex-placed-once', 'every-vertex-placed-once-on-the-communities']) {
      const c = claimOf(id);
      expect(c.expect).toEqual({ against: 'Graph', tolerance: 0 });
      for (const seed of claimSeeds(c)) {
        const slot = bfsSlots(graphAt(c, seed), graphAt(c, seed).s);
        expect([...slot].sort((a, b) => a - b), `${id} seed ${seed}`).toEqual(slot.map((_, i) => i));
      }
      await onThePlate(c);
    }
  });
});

describe('fibonacci-sphere: the bounds, n placements and 2m edges examined on every input', () => {
  for (const shape of kernel.inputs) for (const n of [4, 16, 160, 400]) {
    it(`counts them on the ${shape} input, n ${n}`, () => {
      for (const seed of [4242, 7]) {
        const g = makeGraph(shape, n, seed, ASPECT);
        const t = trace(kernel, g, { s: g.s, t: g.t, p: defaultParams(kernel) }, seed);
        expect(t.counts.places, `${shape} seed ${seed}`).toBe(g.n);
        expect(t.counts.scans, `${shape} seed ${seed}`).toBe(2 * g.m);
      }
    });
  }
});
