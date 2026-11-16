// Where ego-network's claims get their figures (catalogue/entries/ego-network.md, read on the
// plate by test/claims.test.ts and here). Hop distances come from one breadth-first search from
// the subject over the edge lists (test/support/analysis-oracles.ts), never from the plate's
// ring-by-ring expansion; the graph is the plate's input at the claim's seed, the subject g.s.
import { expect } from 'vitest';
import type { Claim } from '../src/core/claims';
import type { GraphKernel } from '../src/engines/graph/trace';
import { kernel as ego } from '../src/kernels/graph/ego-network';
import {
  claimsAgainst, expectSimple, graphAt, hops, neighbours, paramsOf, seedsOf, type Check,
} from './support/analysis-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'ego-network';
const kernel = ego as GraphKernel;

/** The subject's hop distances, k, and the figures the claims read, at every seed. */
function figures(c: Claim) {
  const k = Number(paramsOf(kernel, c).k);
  return seedsOf(c).map((seed) => {
    const g = graphAt(kernel, c, seed);
    expectSimple(g);
    const next = neighbours(g);
    const d = hops(next, g.s);
    const ring = (h: number) => d.filter((x) => x === h).length;
    let scans = 0;
    for (let v = 0; v < g.n; v++) if (d[v] >= 0 && d[v] < k) scans += next[v].length;
    return {
      k, ring, scans, inside: d.filter((x) => x >= 0 && x < k).length,
      rounds: Math.min(k, Math.max(...d) + 1),
    };
  });
}
const one = (c: Claim, pick: (f: ReturnType<typeof figures>[number]) => number): number => {
  const all = figures(c).map(pick);
  expect(new Set(all).size, `${c.id}: one figure at every seed (${all.join(', ')})`).toBe(1);
  return all[0];
};

/** Ring h of the readout ("Ring sizes", its number h + 1) is the count at hop distance h. */
const ringSize = (h: number): Check => (c) => {
  expect(c.expect, c.id).toEqual({ number: h + 1, value: one(c, (f) => f.ring(h)) });
};

/** Expanded: every vertex within k − 1 hops is settled, its edges scanned; the ring at k is the
 * newest, discovered and never expanded. */
const expanded: Check = (c) => {
  expect(c.expect, c.id).toEqual({ value: one(c, (f) => f.inside) });
};

/** The newest ring is the ring at hop k: "Newest ring" against "Ring sizes" number k + 1, exactly,
 * at any seed, as long as the search reaches hop k (the eccentricity is at least k). */
const newestIsTheLastRing: Check = (c) => {
  for (const f of figures(c)) expect(f.ring(f.k), `${c.id}: hop ${f.k} is reached`).toBeGreaterThan(0);
  const k = Number(paramsOf(kernel, c).k);
  expect(c.expect, c.id).toEqual({ against: 'Ring sizes', against_number: k + 1, tolerance: 0 });
};

/** The newest ring's size, from the search. */
const newest: Check = (c) => {
  expect(c.expect, c.id).toEqual({ value: one(c, (f) => f.ring(f.k)) });
};

/** Every expanded vertex scans its whole edge list once: the sum of the degrees within k − 1
 * hops. */
const scans: Check = (c) => {
  expect(c.expect, c.id).toEqual({ value: one(c, (f) => f.scans) });
};

/** At k = 1 only the subject is expanded, and on a simple graph each of its edges reaches a
 * different neighbour: the edges examined are ring 1's size, "Ring sizes" number 2, exactly. */
const subjectEdges: Check = (c) => {
  expect(Number(paramsOf(kernel, c).k)).toBe(1);
  for (const f of figures(c)) expect(f.scans).toBe(f.ring(1));
  expect(c.expect, c.id).toEqual({ against: 'Ring sizes', against_number: 2, tolerance: 0 });
};

/** One round per ring expanded: k, or one more than the eccentricity when the search runs out. */
const rounds: Check = (c) => {
  expect(c.expect, c.id).toEqual({ value: one(c, (f) => f.rounds) });
};

claimsAgainst(ID, {
  'first-ring-is-the-bfs-level': ringSize(1),
  'second-ring-is-the-bfs-level': ringSize(2),
  'first-ring-is-the-bfs-level-at-seed-7': ringSize(1),
  'expanded-are-the-vertices-inside-k': expanded,
  'expanded-are-the-vertices-inside-k-at-seed-7': expanded,
  'newest-ring-is-the-last-ring': newestIsTheLastRing,
  'edges-examined-are-the-inner-degrees': scans,
  'one-hop-scans-the-subject-edges': subjectEdges,
  'one-hop-expands-the-subject-alone': expanded,
  'six-hops-expand-the-bfs-ball': expanded,
  'six-hops-newest-ring': newest,
  'six-hops-take-six-rounds': rounds,
  'small-world-rings-grow-fast': newest,
});
