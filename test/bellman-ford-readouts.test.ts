// bellman-ford's readouts (wave 7a, G5). The plate gave its farthest distance only inside its
// Result sentence, after the reached count, so a claim (which reads a readout's first number)
// could not read it; it now has a Farthest row of its own when no negative cycle is reachable.
// Every expectation here is computed in this file without relaxing edges in rounds: distances by
// Floyd–Warshall on a dense matrix, reachability by an explicit-stack depth-first search.
import { describe, expect, it } from 'vitest';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'bellman-ford';
const N = 60;
const ASPECT = 16 / 9;

const probe = (readout: string, shape: Shape, seed: number): Claim => ({
  id: 'probe', statement: 'a readout test reading', readout, expect: { range: [-1e12, 1e12] },
  setup: { params: { shape }, seed },
});

/** Distances from s by Floyd–Warshall on a dense matrix (no negative cycle on these inputs). */
export function floydFrom(g: Graph, s: number): number[] {
  const d = Array.from({ length: g.n }, (_, i) => Array.from({ length: g.n }, (_, j) => (i === j ? 0 : Infinity)));
  for (let e = 0; e < g.m; e++) {
    const [u, v, w] = [g.eu[e], g.ev[e], g.w[e]];
    if (w < d[u][v]) d[u][v] = w;
    if (!g.directed && w < d[v][u]) d[v][u] = w;
  }
  for (let k = 0; k < g.n; k++) for (let i = 0; i < g.n; i++) {
    if (d[i][k] === Infinity) continue;
    for (let j = 0; j < g.n; j++) if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
  }
  return d[s];
}

const farthest = (dist: number[]) => Math.max(...dist.filter(Number.isFinite));

describe('bellman-ford: the Farthest readout (G5)', () => {
  for (const shape of ['signed', 'signed-dag', 'geometric', 'dag', 'digraph'] as Shape[]) {
    it(`reads the largest finite distance on the ${shape} input`, async () => {
      for (const seed of [7, 4242]) {
        const g = makeGraph(shape, N, seed, ASPECT);
        const r = await read(ID, probe('Farthest', shape, seed));
        expect(r.reason, `${shape} seed ${seed}`).toBeUndefined();
        expect(r.value, `${shape} seed ${seed}: ${r.text}`).toBe(farthest(floydFrom(g, g.s)));
      }
    });
  }

  it('has no Farthest row when a negative cycle is reachable: no distance is defined', async () => {
    const r = await read(ID, probe('Farthest', 'negative-cycle', 4242));
    expect(r.reason).toMatch(/publishes no readout "Farthest"/);
  });
});
