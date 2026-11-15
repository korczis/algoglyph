// centrality-comparison's power-iteration round cap becomes a control (wave 7b C3): the kernel ran
// the power iteration for at most POWER_ROUNDS (300) rounds; it now runs at most `powerRounds`,
// whose default is that constant, so the default run is the old run (compared here within one run
// with a run that passes no value, which takes the constant). The readout names the cap it stopped
// at, or the rounds it converged after.
// Checked here, with oracles written here: the control exists with the old constant as its
// default and travels in a shared link; wherever the cap allows it the run converges after the
// rounds this test's own power iteration needs under the same 1e-10 rule, and reads so; the
// eigenvalue it names is lambda_max by a cyclic Jacobi at every setting, within 1e-3 (the error of
// an unconverged iterate is second order, and 150 rounds, the range's start, are enough on these
// inputs); and the range ends at 850 because one step more passes the 300,000 recorded events
// a trace may hold (test/kernels-graph.test.ts, "graph kernels at their maximum size").
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import * as G from '../src/engines/graph';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace } from '../src/engines/graph/trace';
import { kernel, POWER_ROUNDS, type CentralityResult } from '../src/kernels/graph/centrality-comparison';
import { nthNumber } from './support/claims';
import { settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'centrality-comparison';
const KEY = 'powerRounds';
const SEEDS = [4242, 7];
const ASPECT = 16 / 9;
const defOf = () => kernel.params?.find((d) => d.key === KEY) as RangeParam | undefined;
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return G.engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel);
};
const settings = (d: RangeParam) =>
  Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);
/** The inputs of test/centrality-comparison-readouts.test.ts: each input at the default size,
 * geometric also at the largest. */
const INPUTS: [Shape, number][] = [['communities', 50], ['grid', 50], ['small-world', 50], ['geometric', 80]];

const runAt = (g: Graph, seed: number, p: Params) => trace(kernel, g, { s: g.s, t: g.t, p }, seed);
const row = (r: CentralityResult, g: Graph) =>
  kernel.report!(r, g, { s: g.s, t: g.t, p: {} }).find((x) => x.label === 'Power iteration')!.value;

/** The rounds a power iteration on A + I from the uniform unit vector needs until no score moves
 * by 1e-10, written here from the edge lists. */
function ownRounds(g: Graph): number {
  let x = new Array<number>(g.n).fill(1 / Math.sqrt(g.n));
  for (let it = 1; ; it++) {
    const y = x.slice();
    for (let e = 0; e < g.m; e++) { y[g.eu[e]] += x[g.ev[e]]; y[g.ev[e]] += x[g.eu[e]]; }
    const norm = Math.hypot(...y);
    let moved = 0;
    for (let v = 0; v < g.n; v++) { y[v] /= norm; moved = Math.max(moved, Math.abs(y[v] - x[v])); }
    x = y;
    if (moved < 1e-10) return it;
  }
}

/** The largest eigenvalue of the adjacency matrix, by cyclic Jacobi rotations. */
function lambdaMax(g: Graph): number {
  const n = g.n;
  const a = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let e = 0; e < g.m; e++) { a[g.eu[e]][g.ev[e]] += 1; a[g.ev[e]][g.eu[e]] += 1; }
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] ** 2;
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(a[p][q]) < 1e-300) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1); const s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = a[k][p]; const akq = a[k][q];
        a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = a[p][k]; const aqk = a[q][k];
        a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
      }
    }
  }
  return Math.max(...a.map((r, i) => r[i]));
}

describe('centrality-comparison: power-iteration rounds at most', () => {
  it('is a range control with the old constant as its default', () => {
    expect(POWER_ROUNDS).toBe(300);
    expect(defOf()).toMatchObject({
      kind: 'range', label: 'Power-iteration rounds at most', min: 150, max: 850, step: 50,
      value: POWER_ROUNDS, rebuild: true,
    });
    expect(plate().params.find((x) => x.key === KEY)).toEqual(defOf());
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [150, 500, 850]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('runs at its default exactly as a run that passes no value, which takes the constant', () => {
    for (const shape of kernel.inputs) for (const n of [kernel.n!.min, 50, 80]) for (const seed of SEEDS) {
      const g = makeGraph(shape, n, seed, ASPECT);
      const a = runAt(g, seed, defaultParams(kernel));
      const b = runAt(g, seed, {});
      expect(a.length, `${shape} n=${n} seed=${seed}`).toBe(b.length);
      expect(Array.from(a.events)).toEqual(Array.from(b.events));
      expect(a.counts).toEqual(b.counts);
      expect(a.result).toEqual(b.result);
    }
  });

  it('converges after the test\'s own rounds wherever the cap allows it, and reads so', () => {
    for (const [shape, n] of INPUTS) for (const seed of SEEDS) {
      const g = makeGraph(shape, n, seed, ASPECT);
      const need = ownRounds(g);
      for (const cap of settings(defOf()!)) {
        const t = runAt(g, seed, { ...defaultParams(kernel), [KEY]: cap });
        const r = t.result as CentralityResult;
        const at = `${shape} n=${n} seed=${seed} cap=${cap}`;
        expect(t.truncated, at).toBe(false);
        expect(r.iterations, at).toBe(Math.min(need, cap));
        expect(r.converged, at).toBe(need <= cap);
        expect(row(r, g), at).toMatch(need <= cap
          ? new RegExp(`^converged after ${need} rounds, eigenvalue `)
          : new RegExp(`^stopped at the ${cap}-round cap, eigenvalue `));
      }
    }
  });

  it('the plate reads "converged after N rounds" at a cap the own count says is enough', async () => {
    const g = makeGraph('communities', 50, 4242, ASPECT);
    const need = ownRounds(g);
    expect(need, 'the default input needs more than the default cap').toBeGreaterThan(POWER_ROUNDS);
    const enough = settings(defOf()!).find((c) => c >= need)!;
    for (const cap of [enough, defOf()!.max]) {
      const rows = await settledRows(ID, { [KEY]: cap }, 4242);
      const shown = rows.map((x) => `${x.label}: ${x.value}`).join(' | ');
      expect(rows.find((x) => x.label === 'Power iteration')?.value, shown)
        .toMatch(new RegExp(`^converged after ${need} rounds, eigenvalue `));
      // a round for degrees and one for closeness, then one a power-iteration round
      expect(rows.find((x) => x.label === 'Rounds')?.value, shown).toBe(String(need + 2));
    }
    const rows = await settledRows(ID, { [KEY]: defOf()!.min }, 4242);
    expect(rows.find((x) => x.label === 'Power iteration')?.value)
      .toMatch(new RegExp(`^stopped at the ${defOf()!.min}-round cap, eigenvalue `));
  });

  it('names lambda_max (by Jacobi) as its eigenvalue at every setting, within 1e-3', () => {
    for (const [shape, n] of INPUTS) for (const seed of SEEDS) {
      const g = makeGraph(shape, n, seed, ASPECT);
      const top = lambdaMax(g);
      for (const cap of settings(defOf()!)) {
        const r = runAt(g, seed, { ...defaultParams(kernel), [KEY]: cap }).result as CentralityResult;
        const text = row(r, g);
        expect(Math.abs((nthNumber(text, 2) as number) - top), `${shape} n=${n} seed=${seed} cap=${cap}: ${text}`)
          .toBeLessThanOrEqual(1e-3);
      }
    }
  });

  it('ends where a run at n 80 still fits the memory bound: one step more passes it', () => {
    // communities at n 80, seed 2 (a seed of the maximum-size test) needs 1,735 rounds
    const MAX_EVENTS = 300_000;
    const g = makeGraph('communities', 80, 2);
    const d = defOf()!;
    const at = (cap: number) => runAt(g, 2, { ...defaultParams(kernel), [KEY]: cap });
    const end = at(d.max);
    expect(end.truncated).toBe(false);
    expect(end.length).toBeLessThanOrEqual(MAX_EVENTS);
    const past = at(d.max + d.step);
    expect(past.truncated).toBe(false);
    expect(past.length).toBeGreaterThan(MAX_EVENTS);
  });
});
