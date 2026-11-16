// The ownership input's cross-holdings become a control of effective-ownership, ownership-cycles
// and sugiyama-layout (wave 7b, C1): the graph engine asked for max(1, round(n / 12)) of them;
// for a kernel that declares `crossHoldings` (GraphInput / INPUT_KEYS) it asks for
// max(1, round(n · crossHoldings / 12)), none at 0, so the default 1 is the old graph
// (test/controls-graph-engine.test.ts compares every plate with the old engine). A count: off the
// default the draws after the cross-holdings (share weights, free floats) shift, and only there.
// Checked here: the control exists with the old constant as its default, on the ownership input
// only, it travels in a shared link, it adds cross-holdings and leaves the layered owners and
// their holdings as they were, and it drives the readouts, each against an oracle written here:
// at 0 the input is a DAG (Kahn's algorithm removes every vertex), so ownership-cycles closes no
// cycle and sugiyama reverses no edge, while at every setting a cycle is found and an edge reversed
// exactly when Kahn's algorithm leaves a vertex; and on a DAG effective ownership converges
// after the longest owner chain into the target, so its Rounds are that chain's length (a DP
// over the edge list) plus the one round that moves nothing.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import * as G from '../src/engines/graph';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, type GraphKernel } from '../src/engines/graph/trace';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const kernels = import.meta.glob<GraphKernel>('../src/kernels/graph/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => kernels[`../src/kernels/graph/${id}.ts`];
const plateOf = (id: string) => {
  const e = ENTRIES.find((x) => x.id === id)!;
  return G.engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const KEY = 'crossHoldings';
const PLATES = ['effective-ownership', 'ownership-cycles', 'sugiyama-layout'];
const SEED = 4242;
const ASPECT = 16 / 9;
const defOf = (id: string) => kernelOf(id).params?.find((d) => d.key === KEY) as RangeParam | undefined;
type Input = { crossHoldings?: number };
const graphAt = (n: number, seed: number, input?: Input) =>
  (makeGraph as (s: Shape, n: number, seed: number, a?: number, i?: Input) => Graph)('ownership', n, seed, ASPECT, input);
const inputOf = (k: GraphKernel, p: Params): Input =>
  (G as unknown as { graphInput: (k: GraphKernel, p: Params) => Input }).graphInput(k, p);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, number | string> } });
/** The cross-holdings the engine asks for at n companies. */
const asked = (n: number, k: number) => (k === 0 ? 0 : Math.max(1, Math.round((n * k) / 12)));

/** The vertices Kahn's algorithm cannot remove (in-degree never reaches 0): none iff a DAG. */
function leftByKahn(g: Graph): number {
  const indeg = new Array<number>(g.n).fill(0);
  for (let e = 0; e < g.m; e++) indeg[g.ev[e]]++;
  const queue: number[] = [];
  for (let v = 0; v < g.n; v++) if (indeg[v] === 0) queue.push(v);
  for (let h = 0; h < queue.length; h++) {
    for (let e = 0; e < g.m; e++) if (g.eu[e] === queue[h] && --indeg[g.ev[e]] === 0) queue.push(g.ev[e]);
  }
  return g.n - queue.length;
}

/** The most edges on any owner chain ending at t, by memoised recursion over the edge list
 * (a DAG only): L(v) = max over v -> u of 1 + L(u), L(t) = 0, −∞ where t is out of reach. */
function longestInto(g: Graph, t: number): number {
  const memo = new Map<number, number>();
  const f = (v: number): number => {
    if (v === t) return 0;
    if (memo.has(v)) return memo.get(v)!;
    let best = -Infinity;
    for (let e = 0; e < g.m; e++) if (g.eu[e] === v) best = Math.max(best, 1 + f(g.ev[e]));
    memo.set(v, best);
    return best;
  };
  return Math.max(0, ...Array.from({ length: g.n }, (_, v) => f(v)));
}

describe('effective ownership, ownership cycles and the layered drawing: cross-holdings', () => {
  it('is a range control on the ownership input only, the old constant 1 its default', () => {
    for (const id of PLATES) {
      expect(defOf(id), id).toMatchObject({
        kind: 'range', label: 'Cross-holdings per 12 companies', min: 0, max: 12, step: 1, value: 1, rebuild: true,
      });
      expect(defOf(id)!.hint, id).toBeTruthy();
      expect(plateOf(id).params.find((x) => x.key === KEY), id).toEqual(defOf(id));
    }
    // effective-ownership takes the ownership input alone (no input select to hide it behind)
    expect(defOf('effective-ownership')!.when).toBeUndefined();
    for (const id of ['ownership-cycles', 'sugiyama-layout']) {
      expect(defOf(id)!.when, id).toEqual({ key: 'shape', values: ['ownership'] });
    }
    for (const id of PLATES) expect(kernelOf(id).inputs, id).toContain('ownership');
  });

  it('round-trips through a shared link', () => {
    for (const id of PLATES) {
      const defs = plateOf(id).params;
      const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
      for (const v of [0, 6, 12]) {
        expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7)), `${id} ${v}`).toEqual({ seed: 7, params: { [KEY]: v } });
      }
    }
  });

  it('adds cross-holdings to the layered owners and their holdings, none at 0', () => {
    for (const id of PLATES) expect(inputOf(kernelOf(id), { ...defaultParams(kernelOf(id)), [KEY]: 4 }), id).toEqual({ crossHoldings: 4 });
    for (const n of [4, 40, 60, 200, 240]) {
      for (const seed of [1, 7, SEED]) {
        const dag = graphAt(n, seed, { crossHoldings: 0 });
        expect(leftByKahn(dag), `n ${n} seed ${seed}: a DAG at 0`).toBe(0);
        expect(graphAt(n, seed, { crossHoldings: 1 }), `n ${n} seed ${seed}`).toEqual(graphAt(n, seed));
        for (const k of [1, 2, 6, 12]) {
          const g = graphAt(n, seed, { crossHoldings: k });
          // the same companies and the same holdings first, the cross-holdings after them
          expect([g.n, g.x, g.y, g.s, g.t]).toEqual([dag.n, dag.x, dag.y, dag.s, dag.t]);
          expect(g.eu.slice(0, dag.m)).toEqual(dag.eu);
          expect(g.ev.slice(0, dag.m)).toEqual(dag.ev);
          const extra = g.m - dag.m;
          expect(extra, `n ${n} seed ${seed} k ${k}`).toBeLessThanOrEqual(asked(n, k));
          // each cross-holding is a company holding one of its own owners: a cycle
          if (extra > 0) expect(leftByKahn(g), `n ${n} seed ${seed} k ${k}`).toBeGreaterThan(0);
          // every one asked for is placed on a large enough input (measured over 31 seeds: from
          // n 80 at every setting, from n 40 up to 4); a small one runs out of places sooner
          if (n >= 80 || (n >= 40 && k <= 4)) expect(extra, `n ${n} seed ${seed} k ${k}`).toBe(asked(n, k));
        }
      }
    }
  });

  it('drives the readouts: at 0 no cycle closed, no edge reversed, rounds = longest chain + 1', async () => {
    for (const k of [0, 1, 12]) {
      const cyc = kernelOf('ownership-cycles').n!.value;
      const left = leftByKahn(graphAt(cyc, SEED, { crossHoldings: k }));
      if (k === 0) expect(left).toBe(0); else expect(left).toBeGreaterThan(0);
      const closed = await read('ownership-cycles', claim('Cycles closed', { shape: 'ownership', [KEY]: k }));
      expect(closed.reason).toBeUndefined();
      if (k === 0) expect(closed.value, 'Cycles closed at 0').toBe(0);
      expect(closed.value! > 0, `ownership-cycles at ${k}: a cycle found iff Kahn leaves a vertex`).toBe(left > 0);
      const lay = kernelOf('sugiyama-layout').n!.value;
      const leftLay = leftByKahn(graphAt(lay, SEED, { crossHoldings: k }));
      const rev = await read('sugiyama-layout', claim('Edges reversed to break cycles', { shape: 'ownership', [KEY]: k }));
      expect(rev.reason).toBeUndefined();
      if (k === 0) expect(rev.value, 'Edges reversed at 0').toBe(0);
      expect(rev.value! > 0, `sugiyama at ${k}: an edge reversed iff Kahn leaves a vertex`).toBe(leftLay > 0);
    }
    const n = kernelOf('effective-ownership').n!.value;
    for (const seed of [1, 7, SEED]) {
      const g = graphAt(n, seed, { crossHoldings: 0 });
      const L = longestInto(g, g.t);
      expect(L, `seed ${seed}: someone holds the target`).toBeGreaterThan(0);
      const r = await read('effective-ownership', { ...claim('Rounds', { [KEY]: 0 }), setup: { seed, params: { [KEY]: 0 } } });
      expect(r.reason).toBeUndefined();
      expect(r.value, `seed ${seed}: rounds = ${L} + 1`).toBe(L + 1);
    }
  }, 600_000);
});
