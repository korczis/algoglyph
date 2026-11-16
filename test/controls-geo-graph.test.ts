// geo-graph's iteration count and cooling become controls (wave 7b C4): the kernel ran 200
// iterations and multiplied its temperature (the longest step a vertex may take) by 0.98 after
// each; it now runs `iterations` (force-atlas2's key and label) and cools by `cooling`, whose
// defaults are those constants, so the default run is the old run (compared here within one run
// with a run that passes neither value, which takes the constants).
// Checked here: the controls exist with the old constants as their defaults and travel in a shared
// link; at both ends of each range the plate reads Rounds = iterations and Vertex moves =
// n (iterations + 1) exactly (one place of every vertex on the starting circle, then one an
// iteration), and its "Force balance" is still the virial ratio this test recomputes from the
// run's last positions (as test/geo-graph-readouts.test.ts does at the defaults); cooling changes
// the layout; and the iterations end at 410 because one step more passes the 300,000 recorded
// events a trace may hold (test/kernels-graph.test.ts, "graph kernels at their maximum size").
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import * as G from '../src/engines/graph';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace } from '../src/engines/graph/trace';
import { kernel as fa2 } from '../src/kernels/graph/force-atlas2';
import { kernel, type GeoResult } from '../src/kernels/graph/geo-graph';
import { nthNumber } from './support/claims';
import { settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'geo-graph';
const ASPECT = 16 / 9;
const SHAPES = kernel.inputs as Shape[];
const defOf = (key: string) => kernel.params?.find((d) => d.key === key) as RangeParam | undefined;
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return G.engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel);
};
const runAt = (g: Graph, seed: number, p: Params) => trace(kernel, g, { s: g.s, t: g.t, p }, seed);

/** The virial ratio of positions x, y, written as test/geo-graph-readouts.test.ts writes it. */
function balance(g: Graph, pull: number, x: number[], y: number[]): number {
  const n = g.n;
  const cx = g.x.reduce((s, v) => s + v, 0) / n; const cy = g.y.reduce((s, v) => s + v, 0) / n;
  const span = Math.max(...g.x.map((gx, v) => Math.hypot(gx - cx, g.y[v] - cy)));
  const L = Math.sqrt((Math.PI * span * span) / n);
  const k = (4 * pull * n) / Math.max(1, Math.sqrt(n)) / L;
  const mx = x.reduce((s, v) => s + v, 0) / n; const my = y.reduce((s, v) => s + v, 0) / n;
  let attract = 0; let spring = 0;
  for (let e = 0; e < g.m; e++) attract += Math.hypot(x[g.eu[e]] - x[g.ev[e]], y[g.eu[e]] - y[g.ev[e]]) ** 3 / L;
  for (let v = 0; v < n; v++) spring += k * ((g.x[v] - x[v]) * (x[v] - mx) + (g.y[v] - y[v]) * (y[v] - my));
  return (attract - spring) / ((L * L * n * (n - 1)) / 2);
}

describe('geo-graph: iterations and cooling', () => {
  it('are range controls with the old constants as their defaults', () => {
    expect(defOf('iterations')).toMatchObject({
      kind: 'range', label: 'Iterations', min: 20, max: 410, step: 10, value: 200, rebuild: true,
    });
    // force-atlas2's key and label for the same count
    const theirs = fa2.params!.find((d) => d.key === 'iterations')!;
    expect(defOf('iterations')!.label).toBe(theirs.label);
    expect(defOf('cooling')).toMatchObject({
      kind: 'range', label: 'Cooling per iteration', min: 0, max: 1, step: 0.01, value: 0.98, rebuild: true,
    });
    for (const key of ['iterations', 'cooling']) expect(plate().params.find((x) => x.key === key)).toEqual(defOf(key));
  });

  it('round-trip through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const [it, cool] of [[20, 0], [300, 0.9], [410, 1]]) {
      expect(parse(defs, serialise(defs, { ...d, iterations: it, cooling: cool }, 7)))
        .toEqual({ seed: 7, params: { iterations: it, cooling: cool } });
    }
  });

  it('run at their defaults exactly as a run that passes neither, which takes the constants', () => {
    for (const shape of SHAPES) for (const n of [kernel.n!.min, kernel.n!.value]) for (const seed of [DEFAULT_SEED, 7]) {
      const g = makeGraph(shape, n, seed, ASPECT);
      const a = runAt(g, seed, defaultParams(kernel));
      const b = runAt(g, seed, { pull: defaultParams(kernel).pull });
      expect(a.length, `${shape} n=${n} seed=${seed}`).toBe(b.length);
      expect(Array.from(a.events)).toEqual(Array.from(b.events));
      expect(a.counts).toEqual(b.counts);
      expect(a.result).toEqual(b.result);
    }
  });

  it('cooling changes the layout', () => {
    const g = makeGraph('geometric', kernel.n!.value, DEFAULT_SEED, ASPECT);
    const at = (cooling: number) => runAt(g, DEFAULT_SEED, { ...defaultParams(kernel), cooling }).result as GeoResult;
    expect(at(0).x).not.toEqual(at(1).x);
    expect(at(0.98).x).not.toEqual(at(1).x);
  });

  const SETTINGS: Record<string, number>[] = [
    { iterations: 20, cooling: 0.98 }, { iterations: 410, cooling: 0.98 },
    { iterations: 200, cooling: 0 }, { iterations: 200, cooling: 1 }, { iterations: 410, cooling: 1 },
    { iterations: 20, cooling: 0 },
  ];
  for (const shape of SHAPES) for (const set of SETTINGS) {
    it(`reads Rounds = iterations, Vertex moves = n (iterations + 1) and the force balance: ${shape} ${JSON.stringify(set)}`,
      async () => {
        const seed = DEFAULT_SEED;
        const n = kernel.n!.value;
        const pull = Number(defaultParams(kernel).pull);
        const g = makeGraph(shape, n, seed, ASPECT);
        const t = runAt(g, seed, { ...defaultParams(kernel), ...set });
        const rows = await settledRows(ID, { shape, ...set } as never, seed);
        const shown = rows.map((r) => `${r.label}: ${r.value}`).join(' | ');
        const value = (label: string) => rows.find((r) => r.label === label)?.value;
        expect(value('Rounds'), shown).toBe(String(set.iterations));
        expect(Number(value('Vertex moves')?.replace(/,/g, '')), shown).toBe(n * (set.iterations + 1));
        const text = value('Force balance');
        expect(text, shown).toBeDefined();
        const r = t.result as GeoResult;
        // shown to four decimals
        expect(Math.abs((nthNumber(text!, 1) as number) - balance(g, pull, r.x, r.y)), text)
          .toBeLessThanOrEqual(5e-5 + 1e-12);
      });
  }

  it('the iterations end where a run at n 150 still fits the memory bound: one step more passes it', () => {
    // communities at n 150, seed 137: 413 edges, the most of seeds 1-300 on every input
    const MAX_EVENTS = 300_000;
    const g = makeGraph('communities', 150, 137);
    const d = defOf('iterations')!;
    const at = (iterations: number) => runAt(g, 137, { ...defaultParams(kernel), iterations });
    const end = at(d.max);
    expect(end.truncated).toBe(false);
    expect(end.length).toBe(150 + d.max * (2 * 150 + g.m + 1));
    expect(end.length).toBeLessThanOrEqual(MAX_EVENTS);
    const past = at(d.max + d.step);
    expect(past.truncated).toBe(false);
    expect(past.length).toBeGreaterThan(MAX_EVENTS);
  });
});
