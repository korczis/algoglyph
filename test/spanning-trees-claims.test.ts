// Where the spanning-tree plates' claims get their figures (catalogue/entries/<id>.md `claims`,
// read on the plates by test/claims.test.ts). Every weight and edge count is computed here at the
// claim's own setup by dense Prim (test/support/graph-oracles.ts: an n × n matrix and a linear
// scan, with no heap, union-find or edge sort), so Kruskal, Prim and Borůvka are each held to a
// tree none of them built; every bound is derived below from the graph the setup draws.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from '../src/core/claims';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import type { GraphKernel } from '../src/engines/graph/trace';
import { kernel as kruskal } from '../src/kernels/graph/kruskal-mst';
import { kernel as prim } from '../src/kernels/graph/prim-mst';
import { densePrim } from './support/graph-oracles';

interface Entry { id: string; claims: Claim[] }
const { model } = loadCatalogue(process.cwd()) as { model: { entries: Entry[] } };
const DEFAULT_SEED = 4242;
const WEIGHT = 'Weight of the tree edges';

/** The graph a claim's setup draws, as the plate draws it (16:9, the kernel's default size). */
function graphOf(kernel: GraphKernel, c: Claim): Graph {
  const p = (c.setup?.params ?? {}) as Record<string, unknown>;
  const shape = (p.shape ?? kernel.inputs[0]) as Shape;
  return makeGraph(shape, Number(p.n ?? kernel.n!.value), c.setup?.seed ?? DEFAULT_SEED, 16 / 9);
}

type Check = (c: Claim, g: Graph) => void;

/** A literal claim on the tree's weight: dense Prim's minimum spanning forest weight. */
const weight: Check = (c, g) => {
  expect(c.expect.value, c.id).toBe(densePrim(g).weight);
};

/** A literal claim on the tree edges: a spanning forest of c trees has n − c edges, n − 1 when
 * dense Prim finds the graph connected. */
const treeEdges: Check = (c, g) => {
  const ref = densePrim(g);
  expect(ref.edges, c.id).toBe(g.n - ref.trees);
  expect(c.expect.value, c.id).toBe(ref.edges);
};

/** Kruskal examines the edges in increasing order, each at most once, and stops at the n − 1-th
 * tree edge (or runs out): at most E. Each of the n − c tree edges it takes was examined: at
 * least n − c. The claim's range is [n − c, E]; on a disconnected graph (c > 1) it never reaches
 * n − 1 tree edges, never stops early, and examines exactly E. */
const kruskalScans: Check = (c, g) => {
  const trees = densePrim(g).trees;
  if (c.expect.value !== undefined) {
    expect(trees, `${c.id}: the graph is disconnected`).toBeGreaterThan(1);
    expect(c.expect.value, c.id).toBe(g.m);
  } else expect(c.expect.range, c.id).toEqual([g.n - trees, g.m]);
};

/** Prim takes every vertex into a tree exactly once (a new tree starts at each vertex still
 * outside), and scans its whole edge list then, edges to the tree included: each undirected edge
 * lies on both its endpoints' lists, so with no self-loop the scans are exactly 2E. */
const primScans: Check = (c, g) => {
  for (let e = 0; e < g.m; e++) expect(g.eu[e], `${c.id}: edge ${e} is no self-loop`).not.toBe(g.ev[e]);
  expect(g.out.reduce((s, l) => s + l.length, 0), c.id).toBe(2 * g.m);
  expect(c.expect.value, c.id).toBe(2 * g.m);
};

interface Plate { id: string; kernel: GraphKernel; checks: Record<string, Check>; needs: string[] }

const PLATES: Plate[] = [
  {
    id: 'kruskal-mst', kernel: kruskal as GraphKernel,
    checks: { [WEIGHT]: weight, 'Tree edges': treeEdges, 'Edges examined': kruskalScans },
    needs: [WEIGHT, 'Tree edges', 'Edges examined'],
  },
  {
    id: 'prim-mst', kernel: prim as GraphKernel,
    checks: { [WEIGHT]: weight, 'Tree edges': treeEdges, 'Edges examined': primScans },
    needs: [WEIGHT, 'Tree edges', 'Edges examined'],
  },
];

for (const p of PLATES) {
  describe(`${p.id}: claims against independent references`, () => {
    const entry = model.entries.find((e) => e.id === p.id);
    it('makes a claim on each readout the article names', () => {
      const readouts = new Set(entry?.claims.map((c) => c.readout));
      for (const r of p.needs) expect(readouts.has(r), `${p.id} claims "${r}"`).toBe(true);
    });
    for (const c of entry?.claims ?? []) {
      it(`${c.id}: "${c.readout}"`, () => {
        const check = p.checks[c.readout];
        expect(check, `${p.id} claim ${c.id} reads "${c.readout}", which this file has no reference for`).toBeDefined();
        check(c, graphOf(p.kernel, c));
      });
    }
  });
}

describe('the spanning-tree plates claim one weight per graph', () => {
  it('every plate claims its tree weight at the same settings, with the same value', () => {
    const bySetup = (id: string) => new Map((model.entries.find((e) => e.id === id)?.claims ?? [])
      .filter((c) => c.readout === WEIGHT).map((c) => [JSON.stringify(c.setup ?? {}), c.expect.value]));
    const all = PLATES.map((p) => bySetup(p.id));
    for (const m of all) expect(m.size).toBeGreaterThan(0);
    for (const m of all.slice(1)) expect([...m.entries()].sort()).toEqual([...all[0].entries()].sort());
  });
});
