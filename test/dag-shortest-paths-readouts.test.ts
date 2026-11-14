// dag-shortest-paths' readouts (wave 7a). D4: the relaxation pass marked every vertex of the
// topological order "Relaxed", including those the source cannot reach, whose out-edges it skips
// (80 of 80 on the default graph, where 79 are reached); a vertex is now relaxed only when it is
// reached, so the count is the reachable set's size, and the run's work drops by one settlement per
// unreached vertex. G5: the farthest distance was only the second end of the Reached row's range,
// so a claim (which reads a readout's first number) could not read it; it has a Farthest row of its
// own. Every expectation here is computed in this file without the kernel: reachability by an
// explicit-stack depth-first search over the edge list, distances by Floyd–Warshall.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace } from '../src/engines/graph/trace';
import { kernel } from '../src/kernels/graph/dag-shortest-paths';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'dag-shortest-paths';
const N = 80;
const ASPECT = 16 / 9;

const probe = (readout: string, shape: Shape, seed: number, n = N): Claim => ({
  id: 'probe', statement: 'a readout test reading', readout, expect: { range: [-1e12, 1e12] },
  setup: { params: { shape, n }, seed },
});

/** Which vertices are reachable from s, by depth-first search with an explicit stack. */
function reachable(g: Graph, s: number): boolean[] {
  const seen = new Array<boolean>(g.n).fill(false);
  const stack = [s]; seen[s] = true;
  while (stack.length) {
    const u = stack.pop()!;
    for (let e = 0; e < g.m; e++) if (g.eu[e] === u && !seen[g.ev[e]]) { seen[g.ev[e]] = true; stack.push(g.ev[e]); }
  }
  return seen;
}

describe('dag-shortest-paths: Relaxed counts the reached vertices only (D4)', () => {
  for (const shape of ['signed-dag', 'dag'] as Shape[]) {
    it(`reads the reachable set on the ${shape} input`, async () => {
      for (const seed of [7, 4242]) {
        const g = makeGraph(shape, N, seed, ASPECT);
        const want = reachable(g, g.s).filter(Boolean).length;
        const r = await read(ID, probe('Relaxed', shape, seed));
        expect(r.reason, `${shape} seed ${seed}`).toBeUndefined();
        expect(r.value, `${shape} seed ${seed}: ${r.text}`).toBe(want);
      }
    });
  }

  it('settles exactly the reachable vertices, at every size and seed', () => {
    for (const shape of ['signed-dag', 'dag'] as Shape[]) {
      for (const n of [4, 12, 80, 400]) for (const seed of [1, 7, 11, 4242]) {
        const g = makeGraph(shape, n, seed, ASPECT);
        const t = trace(kernel, g, { s: g.s, t: g.t, p: defaultParams(kernel) }, seed);
        expect(t.counts.settles, `${shape} n ${n} seed ${seed}`).toBe(reachable(g, g.s).filter(Boolean).length);
      }
    }
  });
});

/** Distances from s by Floyd–Warshall on a dense matrix (a DAG has no cycle at all). */
function floydFrom(g: Graph, s: number): number[] {
  const d = Array.from({ length: g.n }, (_, i) => Array.from({ length: g.n }, (_, j) => (i === j ? 0 : Infinity)));
  for (let e = 0; e < g.m; e++) if (g.w[e] < d[g.eu[e]][g.ev[e]]) d[g.eu[e]][g.ev[e]] = g.w[e];
  for (let k = 0; k < g.n; k++) for (let i = 0; i < g.n; i++) {
    if (d[i][k] === Infinity) continue;
    for (let j = 0; j < g.n; j++) if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
  }
  return d[s];
}

const farthest = (dist: number[]) => Math.max(...dist.filter(Number.isFinite));

describe('dag-shortest-paths: the Farthest readout (G5)', () => {
  for (const shape of ['signed-dag', 'dag'] as Shape[]) {
    it(`reads the largest finite distance on the ${shape} input`, async () => {
      for (const seed of [7, 4242]) for (const n of [N, 400]) {
        const g = makeGraph(shape, n, seed, ASPECT);
        const r = await read(ID, probe('Farthest', shape, seed, n));
        expect(r.reason, `${shape} n ${n} seed ${seed}`).toBeUndefined();
        expect(r.value, `${shape} n ${n} seed ${seed}: ${r.text}`).toBe(farthest(floydFrom(g, g.s)));
      }
    });
  }
});

describe('dag-shortest-paths: the claims’ figures', () => {
  const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
  const claimOf = (id: string): Claim => {
    const c = model.entries.find((e) => e.id === ID)?.claims.find((x) => x.id === id);
    expect(c, `${ID} claim ${id}`).toBeDefined();
    return c!;
  };
  const graphOf = (c: Claim) => makeGraph((c.setup?.params?.shape as Shape) ?? 'signed-dag',
    Number(c.setup?.params?.n ?? N), c.setup?.seed ?? DEFAULT_SEED, ASPECT);

  it('one relaxation for each out-edge of a reached vertex, counted from the edge list', () => {
    const c = claimOf('one-relaxation-per-reached-out-edge');
    const g = graphOf(c);
    const seen = reachable(g, g.s);
    let out = 0;
    for (let e = 0; e < g.m; e++) if (seen[g.eu[e]]) out++;
    expect(c.expect.value).toBe(out);
  });

  it('every edge scanned twice while ordering: the offset is 2m', () => {
    const c = claimOf('edges-examined-twice-m-plus-the-relaxations');
    expect(c.expect.offset).toBe(2 * graphOf(c).m);
  });

  it('the farthest distances are Floyd–Warshall’s', () => {
    for (const id of ['farthest-is-floyd-warshall', 'farthest-is-floyd-warshall-without-negative-weights']) {
      const c = claimOf(id);
      const g = graphOf(c);
      expect(c.expect.value, id).toBe(farthest(floydFrom(g, g.s)));
    }
  });
});
