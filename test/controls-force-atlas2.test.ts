// force-atlas2's repulsion scaling becomes a control (wave 7b C5): the kernel's repulsion was
// kr (deg u + 1)(deg v + 1) / d with kr = 2; it is now `scaling`, whose default is that constant,
// so the default run is the old run (compared here within one run with a run that passes no
// value, which takes the constant). The cost does not depend on it: each iteration is the same
// all-pairs pass whatever kr is.
// Checked here, with the energy and the virial ratio written as test/force-atlas2-readouts.test.ts
// writes them, but with the run's own kr: at both ends of the range and at its default, on every
// input at seeds 4242 and 7, "Layout energy" is the energy of the run's first and last positions,
// the end below the start, and "Force balance" is the ratio recomputed from its last positions.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import * as G from '../src/engines/graph';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, OP, trace } from '../src/engines/graph/trace';
import { kernel, type LayoutResult } from '../src/kernels/graph/force-atlas2';
import { nthNumber } from './support/claims';
import { settledRows } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'force-atlas2';
const KEY = 'scaling';
const ASPECT = 16 / 9;
const SHAPES = kernel.inputs as Shape[];
const SEEDS = [DEFAULT_SEED, 7];
const defOf = () => kernel.params?.find((d) => d.key === KEY) as RangeParam | undefined;
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return G.engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel);
};

/** m = deg + 1 for every vertex, from the edge list (a loop counts twice, as a degree does). */
function masses(g: Graph): number[] {
  const m = new Array<number>(g.n).fill(1);
  for (let e = 0; e < g.m; e++) { m[g.eu[e]]++; m[g.ev[e]]++; }
  return m;
}

function energy(g: Graph, kr: number, kg: number, x: number[], y: number[]): number {
  const m = masses(g);
  let e = 0;
  for (let i = 0; i < g.m; i++) {
    const dx = x[g.eu[i]] - x[g.ev[i]]; const dy = y[g.eu[i]] - y[g.ev[i]];
    e += (dx * dx + dy * dy) / 2;
  }
  for (let u = 0; u < g.n; u++) {
    for (let v = u + 1; v < g.n; v++) e -= kr * m[u] * m[v] * Math.log(Math.hypot(x[u] - x[v], y[u] - y[v]));
    e += kg * m[u] * Math.hypot(x[u], y[u]);
  }
  return e;
}

function balance(g: Graph, kr: number, kg: number, x: number[], y: number[]): number {
  const m = masses(g);
  let attract = 0; let gravity = 0; let repel = 0;
  for (let e = 0; e < g.m; e++) attract += (x[g.eu[e]] - x[g.ev[e]]) ** 2 + (y[g.eu[e]] - y[g.ev[e]]) ** 2;
  for (let u = 0; u < g.n; u++) {
    gravity += kg * m[u] * Math.hypot(x[u], y[u]);
    for (let v = u + 1; v < g.n; v++) repel += kr * m[u] * m[v];
  }
  return (attract + gravity) / repel;
}

/** The run as the plate runs it, with the positions it recorded before the first iteration. */
function run(shape: Shape, seed: number, p: Params) {
  const g = makeGraph(shape, kernel.n!.value, seed, ASPECT);
  const params = { ...defaultParams(kernel), ...p };
  const t = trace(kernel, g, { s: g.s, t: g.t, p: params }, seed);
  const x0: number[] = []; const y0: number[] = [];
  for (let i = 0; i < g.n; i++) {
    expect(t.events[5 * i]).toBe(OP.place);
    x0[t.events[5 * i + 1]] = t.events[5 * i + 3]; y0[t.events[5 * i + 1]] = t.events[5 * i + 4];
  }
  return { g, kg: Number(params.gravity), x0, y0, r: t.result as LayoutResult };
}

describe('force-atlas2: repulsion scaling kr', () => {
  it('is a range control with the old constant as its default', () => {
    expect(defOf()).toMatchObject({
      kind: 'range', label: 'Scaling kr', min: 0.1, max: 10, step: 0.1, value: 2, rebuild: true,
    });
    expect(plate().params.find((x) => x.key === KEY)).toEqual(defOf());
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0.1, 5, 10]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('runs at its default exactly as a run that passes no value, which takes the constant', () => {
    for (const shape of SHAPES) for (const n of [kernel.n!.min, kernel.n!.value]) for (const seed of SEEDS) {
      const g = makeGraph(shape, n, seed, ASPECT);
      const p = defaultParams(kernel);
      const a = trace(kernel, g, { s: g.s, t: g.t, p }, seed);
      const b = trace(kernel, g, { s: g.s, t: g.t, p: { iterations: p.iterations, gravity: p.gravity } }, seed);
      expect(a.length, `${shape} n=${n} seed=${seed}`).toBe(b.length);
      expect(Array.from(a.events)).toEqual(Array.from(b.events));
      expect(a.counts).toEqual(b.counts);
      expect(a.result).toEqual(b.result);
    }
  });

  it('costs the same at every setting', () => {
    const g = makeGraph('communities', kernel.n!.value, DEFAULT_SEED, ASPECT);
    const at = (kr: number) => trace(kernel, g, { s: g.s, t: g.t, p: { ...defaultParams(kernel), [KEY]: kr } }, DEFAULT_SEED);
    const base = at(defOf()!.value);
    for (const kr of [defOf()!.min, defOf()!.max]) {
      const t = at(kr);
      expect(t.length).toBe(base.length);
      expect(t.counts).toEqual(base.counts);
    }
  });

  for (const kr of [0.1, 2, 10]) for (const shape of SHAPES) for (const seed of SEEDS) {
    it(`reads the energy and the force balance of its own kr: kr ${kr}, ${shape}, seed ${seed}`, async () => {
      const { g, kg, x0, y0, r } = run(shape, seed, { [KEY]: kr });
      const rows = await settledRows(ID, { shape, [KEY]: kr } as never, seed);
      const shown = rows.map((s) => `${s.label}: ${s.value}`).join(' | ');
      const value = (label: string) => rows.find((s) => s.label === label)?.value;
      const text = value('Layout energy');
      expect(text, shown).toBeDefined();
      const start = energy(g, kr, kg, x0, y0);
      const end = energy(g, kr, kg, r.x, r.y);
      // shown to six significant digits at least
      expect(Math.abs((nthNumber(text!, 1) as number) - start), text).toBeLessThanOrEqual(5e-6 * Math.abs(start));
      expect(Math.abs((nthNumber(text!, 2) as number) - end), text).toBeLessThanOrEqual(5e-6 * Math.abs(end));
      expect(end, text).toBeLessThan(start);
      expect(nthNumber(text!, 2) as number, text).toBeLessThan(nthNumber(text!, 1) as number);
      const b = value('Force balance');
      expect(b, shown).toBeDefined();
      // shown to four decimals
      expect(Math.abs((nthNumber(b!, 1) as number) - balance(g, kr, kg, r.x, r.y)), b).toBeLessThanOrEqual(5e-5 + 1e-12);
    });
  }
});
