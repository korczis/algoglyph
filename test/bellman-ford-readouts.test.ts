// bellman-ford's readouts (wave 7a, G5). The plate gave its farthest distance only inside its
// Result sentence, after the reached count, so a claim (which reads a readout's first number)
// could not read it; it now has a Farthest row of its own when no negative cycle is reachable.
// Every expectation here is computed in this file without relaxing edges in rounds: distances by
// Floyd–Warshall on a dense matrix, reachability by an explicit-stack depth-first search.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { DEFAULT_SEED } from '../src/core/claims';
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

/** The vertices reachable from s, by depth-first search with an explicit stack over the edge list. */
function reachable(g: Graph, s: number): number {
  const seen = new Array<boolean>(g.n).fill(false);
  const stack = [s]; seen[s] = true;
  while (stack.length) {
    const u = stack.pop()!;
    for (let e = 0; e < g.m; e++) {
      const v = g.eu[e] === u ? g.ev[e] : !g.directed && g.ev[e] === u ? g.eu[e] : -1;
      if (v >= 0 && !seen[v]) { seen[v] = true; stack.push(v); }
    }
  }
  return seen.filter(Boolean).length;
}

describe('bellman-ford: the claims’ figures', () => {
  const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
  const claimOf = (id: string): Claim => {
    const c = model.entries.find((e) => e.id === ID)?.claims.find((x) => x.id === id);
    expect(c, `${ID} claim ${id}`).toBeDefined();
    return c!;
  };
  const graphOf = (c: Claim) => makeGraph((c.setup?.params?.shape as Shape) ?? 'signed',
    Number(c.setup?.params?.n ?? N), c.setup?.seed ?? DEFAULT_SEED, ASPECT);

  it('the reached count is the reachable set, counted without relaxing', () => {
    const c = claimOf('reached-is-the-reachable-set');
    const g = graphOf(c);
    expect(c.expect.value).toBe(reachable(g, g.s));
  });

  it('the farthest distances are Floyd–Warshall’s', () => {
    for (const id of ['farthest-is-floyd-warshall', 'farthest-is-floyd-warshall-on-lengths']) {
      const c = claimOf(id);
      const g = graphOf(c);
      expect(c.expect.value, id).toBe(farthest(floydFrom(g, g.s)));
    }
  });

  it('the inputs are what the statements say: no negative cycle, one planted, a connected geometric', () => {
    // Floyd–Warshall's diagonal goes below 0 exactly at the vertices on a negative cycle; one the
    // source reaches is a negative cycle reachable from it
    const negative = (g: Graph) => {
      const d = Array.from({ length: g.n }, (_, i) => Array.from({ length: g.n }, (_, j) => (i === j ? 0 : Infinity)));
      for (let e = 0; e < g.m; e++) d[g.eu[e]][g.ev[e]] = Math.min(d[g.eu[e]][g.ev[e]], g.w[e]);
      for (let k = 0; k < g.n; k++) for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) {
        if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
      }
      return d.some((row, i) => row[i] < 0 && Number.isFinite(d[g.s][i]));
    };
    expect(negative(graphOf(claimOf('last-round-changes-nothing')))).toBe(false);
    expect(negative(graphOf(claimOf('a-negative-cycle-takes-every-round')))).toBe(true);
    const geo = graphOf(claimOf('rounds-at-most-n'));
    expect(reachable(geo, geo.s)).toBe(geo.n);
  });
});
