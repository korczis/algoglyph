// credible-path's claims (wave 7a): the −ln c rule's product of confidences is the largest over
// all source–target paths, and the 1 − c rule's falls below it at seed 7 (the entry's
// misconception). Every literal of the entry is checked here against the largest product computed
// in this file: exp of minus the Floyd–Warshall distance over −ln c on a dense matrix, never the
// kernel's Dijkstra. The readout prints three significant digits (toPrecision(3)), so a value
// claim is that product rounded to three digits within half a unit of the last, and a `below`
// claim's bound is that product cut to three digits, at most the product itself.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { makeGraph, type Graph } from '../src/engines/graph/graph';

const ID = 'credible-path';
const SEED = 4242;
const N = 90;
const ASPECT = 16 / 9;

/** The largest product of confidences over all s–t paths: exp(−d) for the Floyd–Warshall
 * distance d over the edge costs −ln c (both ways: the links are undirected). */
function largestProduct(g: Graph): number {
  const d = Array.from({ length: g.n }, (_, i) => Array.from({ length: g.n }, (_, j) => (i === j ? 0 : Infinity)));
  for (let e = 0; e < g.m; e++) {
    const w = -Math.log(g.w[e]);
    const [u, v] = [g.eu[e], g.ev[e]];
    d[u][v] = Math.min(d[u][v], w);
    d[v][u] = Math.min(d[v][u], w);
  }
  for (let k = 0; k < g.n; k++) for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) {
    if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
  }
  return Math.exp(-d[g.s][g.t]);
}

/** Half a unit of the third significant digit of x. */
const halfUnit = (x: number) => 0.5 * 10 ** (Math.floor(Math.log10(x)) - 2);
/** x cut (not rounded) to three significant digits. */
const cut3 = (x: number) => {
  const u = 10 ** (Math.floor(Math.log10(x)) - 2);
  return Number((Math.floor(x / u) * u).toPrecision(3));
};

describe('credible-path: every claim literal is what the independent oracle gives', () => {
  const entry = ENTRIES.find((e) => e.id === ID)!;
  it('has claims', () => expect(entry.claims.length).toBeGreaterThan(0));
  for (const c of entry.claims) {
    it(c.id, () => {
      expect(c.readout).toBe('Product of confidences');
      const p = (c.setup?.params ?? {}) as Record<string, number | string>;
      const g = makeGraph('links', Number(p.n ?? N), c.setup?.seed ?? SEED, ASPECT);
      const best = largestProduct(g);
      const x = c.expect;
      if (String(p.cost ?? 'doubt') === 'log') {
        // the −ln c rule reaches the largest product: printed to three digits
        expect(x.value).toBe(Number(best.toPrecision(3)));
        expect(x.tolerance).toBeCloseTo(halfUnit(best), 15);
        expect(Math.abs(x.value! - best)).toBeLessThanOrEqual(x.tolerance!);
      } else if (x.below !== undefined && x.below < best) {
        // the 1 − c rule strictly below the largest product: the bound is that product cut to
        // three digits, so a reading below it is below the largest product
        expect(x.below).toBe(cut3(best));
      } else {
        // no rule beats the largest product: the bound is its rounding plus half a unit
        expect(x.below).toBeCloseTo(Number(best.toPrecision(3)) + halfUnit(best), 15);
        expect(x.below!).toBeGreaterThan(best);
      }
    });
  }
});
