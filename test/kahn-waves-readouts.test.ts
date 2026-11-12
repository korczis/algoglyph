// catalogue/entries/kahn-waves.md: "Ringed vertices are the current wave" and "The number of waves
// is one more than the number of edges on the longest dependency chain." The largest current wave
// must be the widest wave, and the plate publishes the longest chain, counted in vertices, so that
// the number of waves can be checked against it.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { makeGraph, type Graph } from '../src/engines/graph/graph';
import { defaultParams, trace } from '../src/engines/graph/trace';
import { kernel, type WavesResult } from '../src/kernels/graph/kahn-waves';
import { holds, read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const SEEDS = [7, DEFAULT_SEED];

const against = (readout: string, other: string, seed: number): Claim => ({
  id: 'kahn-waves-readout', statement: `${readout} equals ${other}`, readout,
  expect: { against: other, tolerance: 0 }, setup: { seed },
});

/** The most vertices on any dependency chain, by memoised depth-first search over the edges. */
function longestChain(g: Graph): number {
  const memo = new Array<number>(g.n).fill(0);
  const from = (u: number): number => {
    if (memo[u]) return memo[u];
    let best = 0;
    for (let e = 0; e < g.m; e++) if (g.eu[e] === u) best = Math.max(best, from(g.ev[e]));
    return (memo[u] = best + 1);
  };
  let best = 0;
  for (let v = 0; v < g.n; v++) best = Math.max(best, from(v));
  return best;
}

describe('kahn-waves readouts', () => {
  for (const seed of SEEDS) {
    it(`the largest current wave is the widest wave (seed ${seed})`, async () => {
      const claim = against('Largest in the current wave', 'Widest wave', seed);
      const r = await read('kahn-waves', claim);
      expect(r.reason).toBeUndefined();
      expect(holds(claim, r.value as number), `${r.text}`).toBe(true);
    }, 120_000);
  }

  for (const seed of SEEDS) {
    it(`the waves equal the vertices on the longest dependency chain (seed ${seed})`, async () => {
      const claim = against('Waves', 'Longest dependency chain', seed);
      const r = await read('kahn-waves', claim);
      expect(r.reason).toBeUndefined();
      expect(holds(claim, r.value as number), `${r.text}`).toBe(true);
    }, 120_000);
  }

  it('the longest chain it reports matches a depth-first recount', () => {
    for (const seed of [3, 11, 29, 7, DEFAULT_SEED]) for (const n of [3, 20, 60, 150]) {
      const g = makeGraph('dag', n, seed);
      const t = trace(kernel, g, { s: 0, t: g.n - 1, p: defaultParams(kernel) });
      const rows = kernel.report?.(t.result as WavesResult, g, t.opts) ?? [];
      const row = rows.find((x) => x.label === 'Longest dependency chain');
      expect(row?.value, `seed ${seed}, n ${n}`).toBe(`${longestChain(g)} vertices`);
    }
  });
});
