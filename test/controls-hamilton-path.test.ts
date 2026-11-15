// hamilton-path's prunings become a toggle (wave 7b C6): the backtracking search always cut the
// branches that cannot succeed (a path whose end no longer reaches every vertex left, and starts
// other than the vertices of degree one when one exists, with three such vertices or an isolated
// one ruling a path out at once). With `prune` off it is the plain search, every start and every
// branch; on, its default, it is the old search, so the default run is the old run (compared here
// within one run with a run that passes no value, which takes the old behaviour).
// Checked here, with a subset DP written here (can a path cover exactly a set of vertices and end
// at v?): at both settings, on every input at sizes small enough for the DP, the plate's "On the
// path" reads n if and only if the DP finds a Hamilton path, wherever the run finishes within the
// kernel's event cap; and the size at which runs without pruning reach the cap is measured.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, ToggleParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import * as G from '../src/engines/graph';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace } from '../src/engines/graph/trace';
import { kernel, type HamiltonResult } from '../src/kernels/graph/hamilton-path';
import { settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'hamilton-path';
const KEY = 'prune';
const ASPECT = 16 / 9;
const SHAPES = kernel.inputs as Shape[];
const defOf = () => kernel.params?.find((d) => d.key === KEY) as ToggleParam | undefined;
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return G.engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel);
};
const runAt = (g: Graph, seed: number, p: Params) => trace(kernel, g, { s: g.s, t: g.t, p }, seed, kernel.cap);

/** Whether a Hamilton path exists, by a subset DP over the edge lists. */
function hasPath(g: Graph): boolean {
  const n = g.n;
  const adj = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  for (let e = 0; e < g.m; e++) if (g.eu[e] !== g.ev[e]) { adj[g.eu[e]][g.ev[e]] = true; adj[g.ev[e]][g.eu[e]] = true; }
  const N = 1 << n;
  const can = Array.from({ length: N }, () => new Uint8Array(n));
  for (let v = 0; v < n; v++) can[1 << v][v] = 1;
  for (let mask = 1; mask < N; mask++) {
    for (let v = 0; v < n; v++) {
      if (!can[mask][v]) continue;
      for (let w = 0; w < n; w++) if (!(mask & (1 << w)) && adj[v][w]) can[mask | (1 << w)][w] = 1;
    }
  }
  return can[N - 1].some(Boolean);
}

describe('hamilton-path: pruning', () => {
  it('is a toggle, on by default, that rebuilds', () => {
    expect(defOf()).toMatchObject({ kind: 'toggle', label: 'Prune dead branches', value: true, rebuild: true });
    expect(plate().params.find((x) => x.key === KEY)).toEqual(defOf());
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    expect(parse(defs, serialise(defs, { ...d, [KEY]: false }, 7))).toEqual({ seed: 7, params: { [KEY]: false } });
  });

  it('runs at its default exactly as a run that passes no value, which takes the old search', () => {
    for (const shape of SHAPES) for (const n of [kernel.n!.min, kernel.n!.value, 24]) for (const seed of [DEFAULT_SEED, 7]) {
      const g = makeGraph(shape, n, seed, ASPECT);
      const a = runAt(g, seed, defaultParams(kernel));
      const b = runAt(g, seed, {});
      expect(a.length, `${shape} n=${n} seed=${seed}`).toBe(b.length);
      expect(Array.from(a.events)).toEqual(Array.from(b.events));
      expect(a.counts).toEqual(b.counts);
      expect(a.truncated).toBe(b.truncated);
      expect(a.result).toEqual(b.result);
    }
  });

  it('off, searches what the prunings cut: three vertices of degree one no longer end it at once', () => {
    let seen = 0;
    for (const shape of SHAPES) for (let n = kernel.n!.min; n <= 12; n++) for (const seed of [DEFAULT_SEED, 7, 1, 2, 3]) {
      const g = makeGraph(shape, n, seed, ASPECT);
      const deg = new Array<number>(g.n).fill(0);
      for (let e = 0; e < g.m; e++) { deg[g.eu[e]]++; deg[g.ev[e]]++; }
      if (deg.filter((d) => d === 1).length < 3 || deg.some((d) => d === 0)) continue;
      seen++;
      const on = runAt(g, seed, { ...defaultParams(kernel), [KEY]: true });
      const off = runAt(g, seed, { ...defaultParams(kernel), [KEY]: false });
      expect(on.counts.discovers, `${shape} n=${n} seed=${seed}`).toBe(0);
      expect(off.truncated).toBe(false);
      // every start is tried, so every vertex joins a path at least once
      expect(off.counts.discovers, `${shape} n=${n} seed=${seed}`).toBeGreaterThanOrEqual(g.n);
      expect((off.result as HamiltonResult).path).toBeNull();
    }
    expect(seen, 'inputs with three vertices of degree one').toBeGreaterThan(0);
  });

  it('finds a path at both settings exactly when the subset DP does, wherever a run finishes', () => {
    let finished = 0; let found = 0; let none = 0;
    for (const shape of SHAPES) for (let n = kernel.n!.min; n <= 14; n++) for (const seed of [DEFAULT_SEED, 7, 1, 2, 3]) {
      const g = makeGraph(shape, n, seed, ASPECT);
      const truth = hasPath(g);
      const runs = [true, false].map((prune) => runAt(g, seed, { ...defaultParams(kernel), [KEY]: prune }));
      for (const [i, t] of runs.entries()) {
        if (t.truncated) continue;
        finished++;
        const r = t.result as HamiltonResult;
        expect(r.path !== null, `${shape} n=${n} seed=${seed} prune=${i === 0}`).toBe(truth);
        if (r.path) {
          found++;
          expect(new Set(r.path).size).toBe(g.n);
        } else none++;
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(none).toBeGreaterThan(0);
    expect(finished).toBeGreaterThan(0);
  });

  for (const prune of [true, false]) for (const shape of SHAPES) {
    it(`reads "On the path" = n iff the DP finds a path: prune ${prune}, ${shape}`, async () => {
      for (const n of [kernel.n!.min, 8, 12]) for (const seed of [DEFAULT_SEED, 7]) {
        const g = makeGraph(shape, n, seed, ASPECT);
        const t = runAt(g, seed, { ...defaultParams(kernel), [KEY]: prune });
        const rows = await settledRows(ID, { shape, n, [KEY]: prune } as never, seed);
        const shown = rows.map((r) => `${r.label}: ${r.value}`).join(' | ');
        if (t.truncated) {
          expect(shown).toMatch(/stopped at the event cap/);
          continue;
        }
        const on = rows.find((r) => r.label === 'On the path')?.value;
        // a grid rounds the size to its rows and columns: the plate's graph is g
        expect(on === String(g.n), `${shape} n=${n} seed=${seed}: ${shown}`).toBe(hasPath(g));
      }
    });
  }
});
