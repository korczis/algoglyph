// Where the flow plates' claims get their figures (catalogue/entries/<id>.md `claims`, read on the
// plates by test/claims.test.ts). Every literal is computed here at the claim's own setup by an
// algorithm other than the plate's (test/support/graph-oracles.ts): the maximum flow by Dinic's
// algorithm, the minimum cost by successive shortest paths, the maximum matching by
// Hopcroft–Karp. Every bound is derived below for the plate's own variant, from the network the
// claim's setup draws; no figure is a reading of the run it is checked on.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from '../src/core/claims';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import type { GraphKernel } from '../src/engines/graph/trace';
import { kernel as edmondsKarp } from '../src/kernels/graph/edmonds-karp';
import { kernel as fordFulkerson } from '../src/kernels/graph/ford-fulkerson';
import { kernel as minCostFlow } from '../src/kernels/graph/min-cost-flow';
import { kernel as preflowPush } from '../src/kernels/graph/preflow-push';
import { dinic, successiveShortestPaths } from './support/graph-oracles';

interface Entry { id: string; claims: Claim[] }
const { model } = loadCatalogue(process.cwd()) as { model: { entries: Entry[] } };
const DEFAULT_SEED = 4242;

/** The network a claim's setup draws, as the plate draws it (16:9, the kernel's default size). */
function graphOf(kernel: GraphKernel, c: Claim): Graph {
  const p = (c.setup?.params ?? {}) as Record<string, unknown>;
  const shape = (p.shape ?? kernel.inputs[0]) as Shape;
  return makeGraph(shape, Number(p.n ?? kernel.n!.value), c.setup?.seed ?? DEFAULT_SEED, 16 / 9);
}

/** How a claim on a readout is checked: a literal against a reference, a bound against its
 * derivation, a comparison of two readouts by its shape alone. */
type Check = (c: Claim, g: Graph) => void;

/** A literal claim on the flow value: Dinic's maximum flow of the claim's network. */
const flowValue: Check = (c, g) => {
  expect(c.expect.value, c.id).toBe(dinic(g, g.s, g.t));
};

/** A comparison claim that must be exact: this readout against another, tolerance 0. */
const exactAgainst = (other: string): Check => (c) => {
  expect(c.expect, c.id).toEqual({ against: other, tolerance: 0 });
};

/** Each augmentation pushes its bottleneck, at least one unit with integer capacities, so the
 * augmentations are at most the flow value: Rounds − Flow value < 1, an integer at most 0. */
const roundsAtMostFlow: Check = (c) => {
  expect(c.expect, c.id).toEqual({ against: 'Flow value', below: 1 });
};

/**
 * Edmonds–Karp's augmentations are at most E·⌊V/2⌋ ≤ VE/2 (the Edmonds–Karp theorem), derived
 * here for this plate's variant: each search is breadth-first and stops once t is seen, so every
 * augmenting path is a shortest s–t path of the residual network, and antiparallel edges are
 * separate edges, each with its own forward arc (room cap − f) and backward arc (room f).
 * (1) Shortest distances from s, δ, and to t, γ, never decrease from one augmentation to the
 * next: the arcs a shortest-path augmentation creates are reverses of arcs on it, which go one
 * level back and shorten no path. (2) Every augmentation saturates or drains at least one arc,
 * its bottleneck, and that edge e = (u, v) is then critical. (3) After e is critical forward
 * (u → v, so δ(v) = δ(u) + 1 and γ(u) = γ(v) + 1 then), it is next on a path backward, v → u,
 * whose length δ'(v) + 1 + γ'(u) ≥ δ(v) + 1 + γ(u) = (δ(u) + 1 + γ(v)) + 2: two more than the
 * path it was critical on; the same holds with the directions swapped. (4) A path has 1 to V − 1
 * edges, so one edge is critical at most ⌊(V − 2)/2⌋ + 1 = ⌊V/2⌋ times, and with at least one
 * critical edge per augmentation there are at most E·⌊V/2⌋ of them. Each augmentation adds at
 * least one unit, so a positive flow needs at least 1. The claim's range is [1, E·⌊V/2⌋].
 */
const edmondsKarpBound: Check = (c, g) => {
  if (c.expect.against !== undefined) return roundsAtMostFlow(c, g);
  expect(dinic(g, g.s, g.t), `${c.id}: a positive flow needs an augmentation`).toBeGreaterThan(0);
  expect(c.expect.range, c.id).toEqual([1, g.m * Math.floor(g.n / 2)]);
};

/**
 * preflow-push's height writes are at most V + (V − 2)(2V − 1), from the push-relabel height bound
 * (an active vertex is never above 2V − 1), derived here for this plate's variant: it writes every
 * vertex's height once at the start (V writes, s at V and the rest at 0) and once per relabel,
 * and only a vertex other than s and t is ever relabelled (activate() admits neither).
 * (1) Heights stay valid, h(u) ≤ h(v) + 1 on every residual arc u → v: s's edges are saturated at
 * the start, so s has no residual arc out (the flow input turns every edge at s outward); a push
 * along an admissible arc (h(u) = h(v) + 1) can only add v → u, which goes down; and a relabel
 * sets h(u) one above its lowest residual neighbour. (2) A relabel raises h(u) by at least 1: the
 * discharge scans every residual arc of u and pushes along each admissible one, so the arcs left
 * when excess remains are not admissible and by (1) lead no lower than h(u), and the new height
 * is their lowest plus 1. (3) A vertex with excess has a residual path back to s (its excess
 * came along a path of positive flow, which runs the other way in the residual network), at
 * most V − 1 arcs long, and by (1) each arc drops at most 1, so h(u) ≤ h(s) + V − 1 = 2V − 1 when
 * it is relabelled. From 0, by steps of at least 1, to at most 2V − 1: at most 2V − 1 relabels for
 * each of the V − 2 vertices. The claim's range is [V, V + (V − 2)(2V − 1)].
 */
const heightWritesBound: Check = (c, g) => {
  expect(c.expect.range, c.id).toEqual([g.n, g.n + (g.n - 2) * (2 * g.n - 1)]);
};

/** A literal claim on the minimum cost: successive shortest paths' cost for a maximum flow. */
const minimumCost: Check = (c, g) => {
  const ref = successiveShortestPaths(g, g.s, g.t);
  expect(ref.value, `${c.id}: successive shortest paths reach the maximum flow`).toBe(dinic(g, g.s, g.t));
  expect(c.expect.value, c.id).toBe(ref.cost);
};

interface Plate { id: string; kernel: GraphKernel; checks: Record<string, Check>; needs: string[] }

const PLATES: Plate[] = [
  {
    id: 'ford-fulkerson', kernel: fordFulkerson as GraphKernel,
    checks: {
      'Flow value': flowValue,
      'Cut capacity': exactAgainst('Flow value'),
      Rounds: roundsAtMostFlow,
    },
    needs: ['Flow value', 'Cut capacity', 'Rounds'],
  },
  {
    id: 'edmonds-karp', kernel: edmondsKarp as GraphKernel,
    checks: {
      'Flow value': flowValue,
      'Cut capacity': exactAgainst('Flow value'),
      Rounds: edmondsKarpBound,
    },
    needs: ['Flow value', 'Cut capacity', 'Rounds'],
  },
  {
    id: 'preflow-push', kernel: preflowPush as GraphKernel,
    checks: {
      'Flow value': flowValue,
      'Cut capacity': exactAgainst('Flow value'),
      'Height writes': heightWritesBound,
    },
    needs: ['Flow value', 'Cut capacity', 'Height writes'],
  },
  {
    id: 'min-cost-flow', kernel: minCostFlow as GraphKernel,
    checks: { 'Flow value': flowValue, 'Minimum cost': minimumCost },
    needs: ['Flow value', 'Minimum cost'],
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
