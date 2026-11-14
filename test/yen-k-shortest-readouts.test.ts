// yen-k-shortest's readouts (wave 7a). The engine's tree count was labelled "Paths found", but the
// kernel draws paths 2..k as tree edges and re-marks the best path's edges over them, so it counts
// the distinct edges that lie on a later path and not on the best one: 4 at k 3 and 0 at k 1 on
// the default graph (D3). The plate now says what that count is and gives the number of paths in
// a row of its own. Every expectation here comes from an enumeration written in this file: the
// loopless s–t paths by depth-first search over the edge list and a dense Floyd–Warshall, never the
// kernel's Dijkstra; the entry's claim literals are checked against them claim by claim.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace, type GraphKernel } from '../src/engines/graph/trace';
import { kernel as yen, type KspResult } from '../src/kernels/graph/yen-k-shortest';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'yen-k-shortest';
const SEED = 4242;
const N = 16;
const ASPECT = 16 / 9;
const ksp = yen as GraphKernel<KspResult>;

const probe = (readout: string, params: Record<string, number | string> = {}, seed = SEED): Claim => ({
  id: 'probe', statement: 'a readout test reading', readout, expect: { range: [-1e12, 1e12] },
  setup: { params, seed },
});

/** Every loopless s–t path's cost, by depth-first search over the edge list (both ways when
 * undirected), sorted: the k-th smallest is the k-th of Yen's costs, ties included. */
function looplessCosts(g: Graph, s: number, t: number): number[] {
  const arcs: [number, number][][] = Array.from({ length: g.n }, () => []);
  for (let e = 0; e < g.m; e++) {
    arcs[g.eu[e]].push([g.ev[e], g.w[e]]);
    if (!g.directed) arcs[g.ev[e]].push([g.eu[e], g.w[e]]);
  }
  const out: number[] = [];
  const on = new Array<boolean>(g.n).fill(false);
  const walk = (v: number, cost: number) => {
    if (v === t) { out.push(cost); return; }
    on[v] = true;
    for (const [u, w] of arcs[v]) if (!on[u]) walk(u, cost + w);
    on[v] = false;
  };
  if (s !== t) walk(s, 0);
  return out.sort((a, b) => a - b);
}

const graphAt = (shape: Shape, n: number, seed: number) => makeGraph(shape, n, seed, ASPECT);

describe('yen-k-shortest: the paths-found readout counts paths (D3)', () => {
  it('reads k paths, or every loopless path when there are fewer than k', async () => {
    for (const [params, n] of [[{}, N], [{ k: 1 }, N], [{ k: 8 }, N], [{ k: 8, n: 4 }, 4]] as const) {
      const g = graphAt('geometric', n, SEED);
      const k = Number((params as { k?: number }).k ?? 3);
      const want = Math.min(k, looplessCosts(g, g.s, g.t).length);
      const r = await read(ID, probe('Paths found', params));
      expect(r.reason, JSON.stringify(params)).toBeUndefined();
      expect(r.value, `${JSON.stringify(params)}: ${r.text}`).toBe(want);
    }
  });

  it('labels the edge count by what it counts: edges on a later path and not on the best one', async () => {
    for (const k of [1, 3, 8]) {
      const g = graphAt('geometric', N, SEED);
      const res = trace(ksp, g, { s: g.s, t: g.t, p: { ...defaultParams(ksp), k } }, SEED).result!;
      const best = new Set(res.paths[0].edges);
      const later = new Set(res.paths.slice(1).flatMap((q) => q.edges).filter((e) => !best.has(e)));
      const r = await read(ID, probe('Edges only on later paths', { k }));
      expect(r.reason, `k ${k}`).toBeUndefined();
      expect(r.value, `k ${k}`).toBe(later.size);
    }
  });

  it('publishes every settled readout under its own label', async () => {
    const rows = await settledLabels();
    expect(rows.length).toBeGreaterThan(4);
    expect(new Set(rows).size, rows.join(' | ')).toBe(rows.length);
  });
});

/** The labels of the settled default run, read through the claims instrument's own reasons. */
async function settledLabels(): Promise<string[]> {
  const r = await read(ID, probe('no such readout'));
  const m = /it publishes: (.*)$/.exec(r.reason ?? '');
  return m ? [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]) : [];
}

/** The s–t distance by Floyd–Warshall on a dense matrix of the edge lengths. */
function floydDistance(g: Graph, s: number, t: number): number {
  const d = Array.from({ length: g.n }, (_, i) => Array.from({ length: g.n }, (_, j) => (i === j ? 0 : Infinity)));
  for (let e = 0; e < g.m; e++) {
    const [u, v, w] = [g.eu[e], g.ev[e], g.w[e]];
    d[u][v] = Math.min(d[u][v], w);
    if (!g.directed) d[v][u] = Math.min(d[v][u], w);
  }
  for (let k = 0; k < g.n; k++) for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) {
    if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
  }
  return d[s][t];
}

describe('yen-k-shortest: every claim literal is what the independent oracles give', () => {
  const entry = ENTRIES.find((e) => e.id === ID)!;
  it('has claims', () => expect(entry.claims.length).toBeGreaterThan(0));
  for (const c of entry.claims) {
    it(c.id, () => {
      const p = (c.setup?.params ?? {}) as Record<string, number | string>;
      const shape = String(p.shape ?? 'geometric') as Shape;
      const k = Number(p.k ?? 3);
      const g = graphAt(shape, Number(p.n ?? N), c.setup?.seed ?? SEED);
      const costs = looplessCosts(g, g.s, g.t);
      const x = c.expect;
      if (c.readout === 'Path costs' && x.against === undefined) {
        // the first path: the distance, by Floyd–Warshall and by the enumeration alike
        expect(x.value).toBe(floydDistance(g, g.s, g.t));
        expect(x.value).toBe(costs[0]);
      } else if (c.readout === 'Path costs') {
        // the j-th path against the first: both from the enumeration, the j-th within the paths found
        const j = x.against_number!;
        expect(x.against).toBe('Path costs');
        expect(j).toBeLessThanOrEqual(Math.min(k, costs.length));
        expect(x.offset).toBe(costs[0] - costs[j - 1]);
        expect(x.tolerance).toBe(0);
      } else if (c.readout === 'Paths found') {
        expect(x.value).toBe(Math.min(k, costs.length));
      } else if (c.readout === 'Rounds') {
        expect(x).toEqual({ against: 'Paths found', tolerance: 0 });
      } else if (c.readout === 'Edges only on later paths') {
        expect(k).toBe(1);
        expect(x.value).toBe(0);
      } else {
        throw new Error(`no oracle for readout ${c.readout}`);
      }
    });
  }
});
