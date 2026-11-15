// Independent references for the connectivity plates' claims (wave 7b: articulation-points,
// bridges, connected-components, euler-tour, hamilton-path, ownership-cycles), written over the
// Graph's edge lists alone and never as the plates run: components by breadth-first search, cut
// vertices and bridges by deleting each vertex or edge and counting again, Hamilton paths by a
// dynamic programme over vertex subsets, cycles by Kahn's peeling and the classes of mutual
// reachability. And the harness every connectivity claims test shares: each claim's expectation
// is computed here at every seed it names and must equal the one authored, and the plate is read
// through the instrument (test/support/claims.ts) at the same setup.
import { describe, expect, it } from 'vitest';
import { claimSeeds, type Claim } from '../../src/core/claims';
import type { Graph } from '../../src/engines/graph/graph';
import type { GraphKernel } from '../../src/engines/graph/trace';
import { failures } from './claims';
import { claimGraph, entryClaims, mutualClasses } from './digraph-oracles';

/** The sizes of the connected components left once vertex `gone` and edge `cut` are deleted
 * (-1 deletes nothing), by a breadth-first search from every vertex not yet reached. */
export function componentSizes(g: Graph, gone = -1, cut = -1): number[] {
  const adj: number[][] = Array.from({ length: g.n }, () => []);
  for (let e = 0; e < g.m; e++) {
    if (e === cut || g.eu[e] === gone || g.ev[e] === gone) continue;
    adj[g.eu[e]].push(g.ev[e]); adj[g.ev[e]].push(g.eu[e]);
  }
  const seen = new Array<boolean>(g.n).fill(false);
  const sizes: number[] = [];
  for (let s = 0; s < g.n; s++) {
    if (seen[s] || s === gone) continue;
    seen[s] = true;
    const queue = [s];
    for (let i = 0; i < queue.length; i++) {
      for (const v of adj[queue[i]]) if (!seen[v]) { seen[v] = true; queue.push(v); }
    }
    sizes.push(queue.length);
  }
  return sizes;
}

/** The number of connected components. */
export const components = (g: Graph, gone = -1, cut = -1) => componentSizes(g, gone, cut).length;

/** Each vertex's degree, a self-loop counting twice. */
export function degrees(g: Graph): number[] {
  const deg = new Array<number>(g.n).fill(0);
  for (let e = 0; e < g.m; e++) { deg[g.eu[e]]++; deg[g.ev[e]]++; }
  return deg;
}

/** Whether any edge joins a vertex to itself: the identities below assume none. */
export const hasSelfLoop = (g: Graph) => g.eu.some((u, e) => u === g.ev[e]);

/** The cut vertices: those whose deletion leaves more components than the graph has. */
export function cutVertices(g: Graph): boolean[] {
  const c = components(g);
  return Array.from({ length: g.n }, (_, v) => components(g, v) > c);
}

/** The bridges: the edges whose deletion leaves more components than the graph has. */
export function bridgesByRemoval(g: Graph): boolean[] {
  const c = components(g);
  return Array.from({ length: g.m }, (_, e) => components(g, -1, e) > c);
}

/** The cut vertices that lie on a cycle: one of their edges is not a bridge (deleting it leaves
 * its two ends connected, so it closes a cycle with the path that remains). */
export function cutVerticesOnCycles(g: Graph): number {
  const cut = cutVertices(g);
  const bridge = bridgesByRemoval(g);
  let k = 0;
  for (let v = 0; v < g.n; v++) {
    if (!cut[v]) continue;
    let cyclic = false;
    for (let e = 0; e < g.m && !cyclic; e++) cyclic = (g.eu[e] === v || g.ev[e] === v) && !bridge[e];
    if (cyclic) k++;
  }
  return k;
}

/**
 * The biconnected blocks (maximal pieces with no cut vertex of their own, each with at least one
 * edge), by the block identity, with no search for blocks. In a connected graph with at least one
 * edge the blocks and the cut vertices form a tree (the block-cut tree), whose edges join each
 * cut vertex v to the b(v) blocks it lies in: b + a − 1 = Σ_cut b(v), so b = 1 + Σ_v (b(v) − 1).
 * Deleting v leaves exactly b(v) pieces of its component (b(v) = 1 for a vertex that is not a
 * cut vertex), so b(v) − 1 = c(G − v) − c(G). Summed over the components with an edge, and an
 * isolated vertex (whose deletion lowers the count by one) left out:
 * b = #{components with an edge} + Σ_{v of degree > 0} (c(G − v) − c(G)).
 */
export function blocksByIdentity(g: Graph): number {
  const c = components(g);
  const deg = degrees(g);
  let b = componentSizes(g).filter((s) => s >= 2).length;
  for (let v = 0; v < g.n; v++) if (deg[v] > 0) b += components(g, v) - c;
  return b;
}

/** Whether a Hamilton path exists, by the subset dynamic programme: ends[S] holds the vertices v
 * such that some path visits exactly the vertices of S and ends at v. 2^n states, so n <= 24. */
export function hamiltonPathExists(g: Graph): boolean {
  const n = g.n;
  expect(n, 'the subset programme is for small graphs').toBeLessThanOrEqual(24);
  const adj = new Array<number>(n).fill(0);
  for (let e = 0; e < g.m; e++) { adj[g.eu[e]] |= 1 << g.ev[e]; adj[g.ev[e]] |= 1 << g.eu[e]; }
  const ends = new Uint32Array(1 << n);
  for (let v = 0; v < n; v++) ends[1 << v] = 1 << v;
  for (let set = 1; set < 1 << n; set++) {
    for (let v = 0; v < n; v++) {
      if (!(ends[set] & (1 << v))) continue;
      for (let next = adj[v] & ~set; next; next &= next - 1) {
        const bit = next & -next;
        ends[set | bit] |= bit;
      }
    }
  }
  return ends[(1 << n) - 1] !== 0;
}

/** Whether `path` visits every vertex of g exactly once, each step along an edge of g. */
export function isHamiltonPath(g: Graph, path: number[]): boolean {
  const edge = new Set<number>();
  for (let e = 0; e < g.m; e++) { edge.add(g.eu[e] * g.n + g.ev[e]); edge.add(g.ev[e] * g.n + g.eu[e]); }
  return path.length === g.n && new Set(path).size === g.n
    && path.every((v, i) => i === 0 || edge.has(path[i - 1] * g.n + v));
}

/** The vertices Kahn's algorithm cannot peel (never of in-degree 0): none exactly when the
 * digraph has no cycle. */
export function unpeeled(g: Graph): number {
  const indeg = new Array<number>(g.n).fill(0);
  for (let e = 0; e < g.m; e++) indeg[g.ev[e]]++;
  const queue: number[] = [];
  for (let v = 0; v < g.n; v++) if (!indeg[v]) queue.push(v);
  for (let i = 0; i < queue.length; i++) {
    for (let e = 0; e < g.m; e++) if (g.eu[e] === queue[i] && --indeg[g.ev[e]] === 0) queue.push(g.ev[e]);
  }
  return g.n - queue.length;
}

/** The strong components with at least two vertices (the only ones holding a cycle when no edge
 * is a self-loop): how many, their vertices, and their cycle rank Σ (m_C − |C| + 1), m_C the
 * edges inside C. */
export function cyclicComponents(g: Graph): { count: number; vertices: number; rank: number } {
  const cls = mutualClasses(g);
  const size = new Map<number, number>();
  for (const k of cls) size.set(k, (size.get(k) ?? 0) + 1);
  const big = [...size.entries()].filter(([, s]) => s >= 2);
  let inside = 0;
  for (let e = 0; e < g.m; e++) {
    if (cls[g.eu[e]] === cls[g.ev[e]] && (size.get(cls[g.eu[e]]) ?? 0) >= 2) inside++;
  }
  const vertices = big.reduce((a, [, s]) => a + s, 0);
  return { count: big.length, vertices, rank: inside - vertices + big.length };
}

/** A claim's expectation computed from the graph its run draws at one of its seeds. */
export type Oracle = (g: Graph, c: Claim) => Claim['expect'];

/** The expectation of a range claim, an exact value when its ends meet. */
export const between = (lo: number, hi: number): Claim['expect'] => (lo === hi ? { value: lo } : { range: [lo, hi] });

/**
 * Every claim of entry `id` against its oracle: the authored expectation must equal the one
 * computed here from the graph drawn at each seed the claim names (the kernel's input, its
 * controls, the claim's params), and the plate, read by the instrument, must meet it. A claim
 * with no oracle here, or an oracle with no claim, fails.
 */
export function claimsAgainstOracles(id: string, kernel: GraphKernel, oracles: Record<string, Oracle>): void {
  const claims = entryClaims(id) as unknown as Claim[];
  describe(`${id}: every claim's expectation is computed here, and the plate meets it`, () => {
    it('has an oracle for each claim and a claim for each oracle', () => {
      expect(claims.map((c) => c.id).sort()).toEqual(Object.keys(oracles).sort());
    });
    for (const c of claims) {
      it(`${c.id}: "${c.readout}"`, async () => {
        const oracle = oracles[c.id];
        expect(oracle, `${id} claim ${c.id} has no oracle in its test`).toBeDefined();
        for (const seed of claimSeeds(c)) {
          const g = claimGraph(kernel, { ...c, setup: { params: c.setup?.params, seed } });
          expect(hasSelfLoop(g), `${c.id} at seed ${seed}: the references assume no self-loop`).toBe(false);
          expect(c.expect, `${c.id} at seed ${seed}`).toEqual(oracle(g, c));
        }
        expect(await failures(id, c), `catalogue/entries/${id}.md claim ${c.id}`).toEqual([]);
      }, 120_000);
    }
  });
}
