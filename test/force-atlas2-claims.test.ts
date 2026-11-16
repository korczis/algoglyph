// Where force-atlas2's claims get their figures (catalogue/entries/force-atlas2.md, read by
// test/claims.test.ts and here through the same instrument). Every expectation is computed in
// this file, never read from the kernel: the counts from the graph's size and the iterations
// asked for, and the start energy from a start drawn here from the seed (mulberry32, x then y for
// every vertex, uniform on [-10, 10)) and the energy written here,
//   E = sum over edges d^2 / 2 - kr sum over pairs m_u m_v ln d + kg sum over vertices m |x|,
// with m = deg + 1 (test/force-atlas2-readouts.test.ts checks by central differences that minus
// its gradient is the force the run applies). The end energy, which needs the run itself, and
// "the energy falls", which no theorem guarantees for this step rule, are not claimed; neither is
// "Force balance" (integrator decision h: the run stops short of a fixed point).
import { describe, expect, it } from 'vitest';
import { claimSeeds, type Claim } from '../src/core/claims';
import { count } from '../src/core/format';
import { mulberry32 } from '../src/core/random';
import { makeGraph, type Graph } from '../src/engines/graph/graph';
import { defaultParams, trace, type GraphKernel } from '../src/engines/graph/trace';
import { kernel as fa2 } from '../src/kernels/graph/force-atlas2';
import { failures } from './support/claims';
import { claimGraph, entryClaims } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'force-atlas2';
const kernel = fa2 as GraphKernel;
const ASPECT = 16 / 9;
const claims = entryClaims(ID) as unknown as Claim[];
const claimOf = (id: string): Claim => {
  const c = claims.find((x) => x.id === id);
  expect(c, `${ID} claim ${id}`).toBeDefined();
  return c!;
};
const graphAt = (c: Claim, seed: number): Graph =>
  claimGraph(kernel, { ...c, setup: { params: c.setup?.params, seed } } as never);
/** The claim's parameters over the plate's defaults. */
const paramsOf = (c: Claim) => ({ ...defaultParams(kernel), ...(c.setup?.params ?? {}) }) as Record<string, number>;

async function onThePlate(c: Claim) {
  expect(await failures(ID, c), `${ID} claim ${c.id}`).toEqual([]);
}

/** The random start the seed draws: x then y for every vertex, uniform on [-10, 10). */
function start(n: number, seed: number) {
  const rnd = mulberry32(seed);
  const x: number[] = []; const y: number[] = [];
  for (let v = 0; v < n; v++) { x.push((rnd() - 0.5) * 20); y.push((rnd() - 0.5) * 20); }
  return { x, y };
}

function energy(g: Graph, kr: number, kg: number, x: number[], y: number[]): number {
  const m = new Array<number>(g.n).fill(1);
  for (let e = 0; e < g.m; e++) { m[g.eu[e]]++; m[g.ev[e]]++; }
  let attract = 0; let repel = 0; let gravity = 0;
  for (let e = 0; e < g.m; e++) attract += ((x[g.eu[e]] - x[g.ev[e]]) ** 2 + (y[g.eu[e]] - y[g.ev[e]]) ** 2) / 2;
  for (let u = 0; u < g.n; u++) {
    gravity += kg * m[u] * Math.hypot(x[u], y[u]);
    for (let v = u + 1; v < g.n; v++) repel += m[u] * m[v] * Math.log(Math.hypot(x[u] - x[v], y[u] - y[v]));
  }
  return attract - kr * repel + gravity;
}

/** An energy as the plate shows it: digit groups for a large one, six significant digits else;
 * refused near a rounding boundary, where the order of a sum could move it. */
function shown(e: number): number {
  const big = Math.abs(e) >= 1e5;
  const scale = big ? 1 : 10 ** (5 - Math.floor(Math.log10(Math.abs(e))));
  const frac = Math.abs(e * scale) % 1;
  expect(Math.abs(frac - 0.5), `${e} is not near a rounding boundary`).toBeGreaterThan(1e-6);
  return Number((big ? count(Math.round(e)) : e.toPrecision(6)).replace(/,/g, ''));
}

describe('force-atlas2: the claims’ figures, computed here', () => {
  it('the rounds are the iterations asked for', async () => {
    for (const id of ['one-round-per-iteration', 'one-round-per-iteration-at-500']) {
      const c = claimOf(id);
      expect(c.expect.value, id).toBe(paramsOf(c).iterations);
      await onThePlate(c);
    }
  });

  it('the vertex moves are n(it + 1)', async () => {
    for (const id of ['vertex-moves-are-n-times-iterations-plus-one', 'vertex-moves-at-500-iterations',
      'vertex-moves-on-the-smallest-input']) {
      const c = claimOf(id);
      for (const seed of claimSeeds(c)) {
        const g = graphAt(c, seed);
        expect(c.expect.value, `${id} seed ${seed}`).toBe(g.n * (paramsOf(c).iterations + 1));
      }
      await onThePlate(c);
    }
  });

  it('the start energy is E of the start the seed draws', async () => {
    for (const id of ['start-energy', 'start-energy-at-seed-7', 'start-energy-at-the-highest-scaling',
      'start-energy-at-the-lowest-scaling']) {
      const c = claimOf(id);
      const seed = claimSeeds(c)[0];
      const g = graphAt(c, seed);
      const p = paramsOf(c);
      const { x, y } = start(g.n, seed);
      expect(c.expect.value, id).toBe(shown(energy(g, p.scaling, p.gravity, x, y)));
      await onThePlate(c);
    }
  });
});

describe('force-atlas2: the bounds, n(it + 1) moves and it · m edges examined', () => {
  for (const shape of kernel.inputs) {
    it(`counts them on the ${shape} input`, () => {
      for (const [n, iterations] of [[4, 20], [30, 60], [70, 250]]) for (const seed of [4242, 7]) {
        const g = makeGraph(shape, n, seed, ASPECT);
        const t = trace(kernel, g, { s: g.s, t: g.t, p: { ...defaultParams(kernel), iterations } }, seed);
        expect(t.counts.places, `${shape} n ${n} seed ${seed}`).toBe(g.n * (iterations + 1));
        expect(t.counts.scans, `${shape} n ${n} seed ${seed}`).toBe(iterations * g.m);
        expect(t.counts.rounds, `${shape} n ${n} seed ${seed}`).toBe(iterations);
      }
    });
  }
});
