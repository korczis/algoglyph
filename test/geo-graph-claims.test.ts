// Where geo-graph's claims get their figures (catalogue/entries/geo-graph.md, read by
// test/claims.test.ts and here through the same instrument). Every expectation is computed in
// this file, never read from the kernel: the counts from the graph's size and the iterations
// asked for, and the cooling-0 distance from one step of the forces written here. At cooling 0
// the temperature, span/4 for the first iteration, is 0 for every later one, so a vertex moves
// only in the first: from the circle of radius span about the places' centroid (vertex v at angle
// 2 pi v / n) by min(|F|, span/4) along F, the sum of the Fruchterman-Reingold forces (L^2/d
// repulsion between every pair, d^2/L attraction along every edge, L = sqrt(pi span^2 / n)) and
// the map spring 4 pull n / max(1, sqrt n) / L times (a - x). "Force balance" is not claimed
// (integrator decision h: the run stops short of a fixed point).
import { describe, expect, it } from 'vitest';
import { claimSeeds, type Claim } from '../src/core/claims';
import { makeGraph, type Graph } from '../src/engines/graph/graph';
import { defaultParams, trace, type GraphKernel } from '../src/engines/graph/trace';
import { kernel as geo } from '../src/kernels/graph/geo-graph';
import { failures } from './support/claims';
import { claimGraph, entryClaims } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'geo-graph';
const kernel = geo as GraphKernel;
const ASPECT = 16 / 9;
const claims = entryClaims(ID) as unknown as Claim[];
const claimOf = (id: string): Claim => {
  const c = claims.find((x) => x.id === id);
  expect(c, `${ID} claim ${id}`).toBeDefined();
  return c!;
};
const graphAt = (c: Claim, seed: number): Graph =>
  claimGraph(kernel, { ...c, setup: { params: c.setup?.params, seed } } as never);
const paramsOf = (c: Claim) => ({ ...defaultParams(kernel), ...(c.setup?.params ?? {}) }) as Record<string, number>;

async function onThePlate(c: Claim) {
  expect(await failures(ID, c), `${ID} claim ${c.id}`).toEqual([]);
}

/** The mean distance from the map after one step from the starting circle. */
function oneStep(g: Graph, pull: number): number {
  const n = g.n;
  const cx = g.x.reduce((s, v) => s + v, 0) / n; const cy = g.y.reduce((s, v) => s + v, 0) / n;
  const span = Math.max(...g.x.map((gx, v) => Math.hypot(gx - cx, g.y[v] - cy)));
  const L = Math.sqrt((Math.PI * span * span) / n);
  const k = (4 * pull * n) / Math.max(1, Math.sqrt(n)) / L;
  const x = Array.from({ length: n }, (_, v) => cx + span * Math.cos((2 * Math.PI * v) / n));
  const y = Array.from({ length: n }, (_, v) => cy + span * Math.sin((2 * Math.PI * v) / n));
  let total = 0;
  for (let v = 0; v < n; v++) {
    let fx = k * (g.x[v] - x[v]); let fy = k * (g.y[v] - y[v]);
    for (let u = 0; u < n; u++) {
      if (u === v) continue;
      const dx = x[v] - x[u]; const dy = y[v] - y[u];
      const d = Math.max(1e-6, Math.hypot(dx, dy));
      fx += (dx * L * L) / (d * d); fy += (dy * L * L) / (d * d);
    }
    for (const e of g.out[v]) {
      const u = g.eu[e] === v ? g.ev[e] : g.eu[e];
      const dx = x[u] - x[v]; const dy = y[u] - y[v];
      const d = Math.hypot(dx, dy);
      fx += (dx * d) / L; fy += (dy * d) / L;
    }
    const f = Math.hypot(fx, fy);
    const step = f > 0 ? Math.min(f, span / 4) / f : 0;
    total += Math.hypot(x[v] + fx * step - g.x[v], y[v] + fy * step - g.y[v]);
  }
  return total / n;
}

/** Three significant digits, as the plate shows them; refused near a rounding boundary. */
function threeDigits(x: number): number {
  const scaled = x * 10 ** (2 - Math.floor(Math.log10(Math.abs(x))));
  expect(Math.abs((scaled % 1) - 0.5), `${x} is not near a rounding boundary`).toBeGreaterThan(1e-6);
  return Number(x.toPrecision(3));
}

describe('geo-graph: the claims’ figures, computed here', () => {
  it('the rounds are the iterations asked for', async () => {
    for (const id of ['one-round-per-iteration', 'one-round-per-iteration-at-410']) {
      const c = claimOf(id);
      expect(c.expect.value, id).toBe(paramsOf(c).iterations);
      await onThePlate(c);
    }
  });

  it('the vertex moves are n(it + 1)', async () => {
    for (const id of ['vertex-moves-are-n-times-iterations-plus-one', 'vertex-moves-at-410-iterations',
      'vertex-moves-at-20-iterations']) {
      const c = claimOf(id);
      for (const seed of claimSeeds(c)) {
        expect(c.expect.value, `${id} seed ${seed}`).toBe(graphAt(c, seed).n * (paramsOf(c).iterations + 1));
      }
      await onThePlate(c);
    }
  });

  it('at cooling 0 the run ends one step from the circle, whatever the iterations', async () => {
    for (const id of ['no-cooling-left-after-one-step', 'no-cooling-left-after-one-step-at-410',
      'no-cooling-left-after-one-step-at-seed-7']) {
      const c = claimOf(id);
      const p = paramsOf(c);
      expect(p.cooling, id).toBe(0);
      expect(c.expect.value, id).toBe(threeDigits(oneStep(graphAt(c, claimSeeds(c)[0]), p.pull)));
      await onThePlate(c);
    }
  });
});

describe('geo-graph: the bounds, n(it + 1) moves and it · m edges examined', () => {
  for (const shape of kernel.inputs) {
    it(`counts them on the ${shape} input`, () => {
      for (const [n, iterations] of [[4, 20], [30, 60], [60, 200]]) for (const seed of [4242, 7]) {
        const g = makeGraph(shape, n, seed, ASPECT);
        const t = trace(kernel, g, { s: g.s, t: g.t, p: { ...defaultParams(kernel), iterations } }, seed);
        expect(t.counts.places, `${shape} n ${n} seed ${seed}`).toBe(g.n * (iterations + 1));
        expect(t.counts.scans, `${shape} n ${n} seed ${seed}`).toBe(iterations * g.m);
        expect(t.counts.rounds, `${shape} n ${n} seed ${seed}`).toBe(iterations);
      }
    });
  }
});
