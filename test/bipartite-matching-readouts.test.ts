// bipartite-matching's certificate (wave 7a, G2). Every edge of a vertex cover has an endpoint in
// it and no two matched edges share one, so a cover is never smaller than a matching; König's
// theorem says that in a bipartite graph the smallest cover is exactly as large as the largest
// matching, and builds it from a maximum matching: Z, the vertices reachable from the free left
// vertices by alternating paths (an unmatched edge to the right, the matched edge back), gives
// the cover (left vertices outside Z) ∪ (right vertices in Z). The plate now publishes that cover,
// so "König vertex cover" equal to "Maximum matching" certifies the matching maximum. The
// expectation for both is Hopcroft–Karp's matching size (test/support/graph-oracles.ts).
import { describe, expect, it } from 'vitest';
import { makeGraph } from '../src/engines/graph/graph';
import { defaultParams, trace } from '../src/engines/graph/trace';
import { kernel, konigCover, type MatchingResult } from '../src/kernels/graph/bipartite-matching';
import { holds, read, type Claim } from './support/claims';
import { hopcroftKarp } from './support/graph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'bipartite-matching';
const COVER = 'König vertex cover';

const probe = (n: number, seed: number, against?: string): Claim => ({
  id: 'probe', statement: 'a readout test reading', readout: COVER,
  expect: against ? { against, tolerance: 0 } : { range: [-1e12, 1e12] }, setup: { params: { n }, seed },
});

describe('bipartite-matching publishes a König vertex cover (G2)', () => {
  for (const [n, seed] of [[40, 4242], [40, 7], [160, 4242], [4, 7], [11, 3]]) {
    it(`n ${n}, seed ${seed}: the cover is Hopcroft–Karp's matching size and the plate's matching`, async () => {
      const g = makeGraph('bipartite', n, seed);
      const r = await read(ID, probe(n, seed));
      expect(r.reason).toBeUndefined();
      expect(r.value, r.text).toBe(hopcroftKarp(g));
      const c = probe(n, seed, 'Maximum matching');
      const d = await read(ID, c);
      expect(d.reason).toBeUndefined();
      expect(holds(c, d.value as number), d.text).toBe(true);
    });
  }

  it('the cover touches every edge, and has one vertex per matched pair', () => {
    for (const seed of [1, 3, 7, 29, 4242]) for (const n of [4, 5, 17, 40, 101, 160]) {
      const g = makeGraph('bipartite', n, seed);
      const t = trace(kernel, g, { s: g.s, t: g.t, p: defaultParams(kernel) });
      const { mate } = t.result as MatchingResult;
      const cover = konigCover(g, mate);
      for (let e = 0; e < g.m; e++) expect(cover[g.eu[e]] || cover[g.ev[e]], `n ${n} seed ${seed} edge ${e}`).toBe(true);
      const pairs = mate.filter((m, v) => m >= 0 && g.truth[v] === 0).length;
      expect(cover.filter(Boolean).length, `n ${n} seed ${seed}`).toBe(pairs);
      expect(pairs, `n ${n} seed ${seed}`).toBe(hopcroftKarp(g));
    }
  });
});
