// critical-path's longest task duration becomes a control (S3 C4): the graph engine drew every
// vertex weight (a task's duration) as 1 + ⌊u · 9⌋; it now draws 1 + ⌊u · maxDuration⌋ for the
// kernel that declares the control, with the same draw in the same place, so the default 9 is the
// old graph. Checked: the control exists with the old constant as its default, it travels in a
// shared link, it drives what the plate reads (marked = critical tasks at every setting; at 1 the
// project length is the number of vertices on the longest chain, which kahn-waves counts as its
// waves on the same graph), and every other graph plate's input, trace and controls are what they
// were before the control existed (rule 10).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import * as G from '../src/engines/graph';
import { makeGraph, SHAPES, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace, type GraphKernel } from '../src/engines/graph/trace';
import type { CpmResult } from '../src/kernels/graph/critical-path';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const modules = import.meta.glob<GraphKernel>('../src/kernels/graph/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => modules[`../src/kernels/graph/${id}.ts`];
const live = ENTRIES.filter((e) => e.engine === 'graph' && e.status === 'live');
const plateOf = (id: string) => {
  const e = live.find((x) => x.id === id)!;
  return G.engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const ID = 'critical-path';
const KEY = 'maxDuration';
const cpm = kernelOf(ID) as GraphKernel<CpmResult>;
/** The plate's default size and the claims' seed (src/core/claims.ts DEFAULT_SEED). */
const N = 40;
const SEED = 4242;
const ASPECT = 16 / 9;

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);
const defOf = () => cpm.params?.find((d) => d.key === KEY) as RangeParam | undefined;
type Input = { maxDuration?: number };
const graphAt = (shape: Shape, n: number, seed: number, input?: Input) =>
  (makeGraph as (s: Shape, n: number, seed: number, a?: number, i?: Input) => Graph)(shape, n, seed, ASPECT, input);
/** What the graph plates pass to makeGraph for a kernel's own controls (index.ts). */
const inputOf = (k: GraphKernel, p: Params): Input =>
  (G as unknown as { graphInput: (k: GraphKernel, p: Params) => Input }).graphInput(k, p);

/** The most vertices on any chain of the DAG, by memoised recursion over in-edges. */
function chain(g: Graph): number {
  const memo = new Array<number>(g.n).fill(-1);
  const f = (v: number): number => {
    if (memo[v] >= 0) return memo[v];
    let best = 0;
    for (let e = 0; e < g.m; e++) if (g.ev[e] === v) best = Math.max(best, f(g.eu[e]));
    return (memo[v] = best + 1);
  };
  return Math.max(...Array.from({ length: g.n }, (_, v) => f(v)));
}

const claim = (readout: string, params: Params, expect: Claim['expect'] = { range: [-1e12, 1e12] }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });

describe('critical-path: longest task duration', () => {
  it('is a range control with the old constant as its default', () => {
    expect(defOf()).toMatchObject({ kind: 'range', label: 'Longest task duration', min: 1, max: 20, step: 1, value: 9, rebuild: true });
    expect(plateOf(ID).params.find((x) => x.key === KEY)).toEqual(defOf());
  });

  it('round-trips through a shared link', () => {
    const defs = plateOf(ID).params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [1, 5, 20]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('sets the durations to 1..maxDuration, and the project length follows, at every setting', () => {
    expect(defOf(), 'the kernel declares the control').toBeDefined();
    expect(inputOf(cpm, { ...defaultParams(cpm), [KEY]: 5 })).toEqual({ maxDuration: 5 });
    for (const D of settings(defOf()!)) {
      for (const n of [3, 12, N, 300]) {
        for (const seed of [1, 7, SEED]) {
          const g = graphAt('dag', n, seed, { maxDuration: D });
          const base = graphAt('dag', n, seed);
          // the same graph but its weights: the weights are drawn last, one draw a vertex
          expect({ ...g, vw: [] }).toEqual({ ...base, vw: [] });
          for (const w of g.vw) { expect(w).toBeGreaterThanOrEqual(1); expect(w).toBeLessThanOrEqual(D); }
          const r = trace(cpm, g, { s: g.s, t: g.t, p: { ...defaultParams(cpm), [KEY]: D } }, seed).result!;
          const c = chain(g);
          // a chain of c tasks lasting 1..D each: the project lasts c to c · D
          expect(r.length).toBeGreaterThanOrEqual(c);
          expect(r.length).toBeLessThanOrEqual(c * D);
          if (D === 1) expect(r.length, `n=${n} seed=${seed}`).toBe(c);
        }
      }
    }
    const top = graphAt('dag', 300, SEED, { maxDuration: 20 });
    expect(Math.max(...top.vw)).toBeGreaterThan(9);
  });

  it('drives the readouts: at 1 the project length is the longest chain, as kahn-waves counts it', async () => {
    const c = chain(graphAt('dag', N, SEED));
    const len = await read(ID, claim('Project length', { [KEY]: 1 }));
    expect(len.reason).toBeUndefined();
    expect(len.value).toBe(c);
    const waves = await read('kahn-waves', claim('Waves', { n: N }));
    expect(waves.reason).toBeUndefined();
    expect(waves.value).toBe(c);
    for (const D of [1, 20]) {
      const m = await read(ID, claim('Critical (no slack)', { [KEY]: D }, { against: 'Critical tasks', tolerance: 0 }));
      expect(m.reason).toBeUndefined();
      expect(m.value, `marked − critical at ${D}`).toBe(0);
    }
    const long = await read(ID, claim('Project length', { [KEY]: 20 }));
    expect(long.value!).toBeGreaterThanOrEqual(c);
    expect(long.value!).toBeLessThanOrEqual(20 * c);
  });
});

describe('the graph engine at the defaults is what it was before the control', () => {
  // integers only (every shape's vertex weights), recorded on the code before the control
  // existed (main 23b65ad); the floats of the inputs are compared within this run instead
  const WEIGHTS = '4627cff38b12a203';
  const CONTROLS = 'b9f6962ff79beda2';
  const CP_READOUTS = '63399770ebdabfaf';
  const SIZES = [3, 17, 60];
  const SEEDS = [1, SEED];

  it('every shape draws the same vertex weights', () => {
    const all = SHAPES.flatMap((shape) => SIZES.flatMap((n) => SEEDS.map((seed) => [shape, n, seed, makeGraph(shape, n, seed).vw])));
    expect(hash(all)).toBe(WEIGHTS);
  });

  it('every shape draws the same graph with the default passed explicitly', () => {
    for (const shape of SHAPES) for (const n of SIZES) for (const seed of SEEDS) {
      expect(graphAt(shape, n, seed, { maxDuration: 9 }), `${shape} n=${n} seed=${seed}`).toEqual(graphAt(shape, n, seed));
      expect(graphAt(shape, n, seed, {}), `${shape} n=${n} seed=${seed}`).toEqual(graphAt(shape, n, seed));
    }
  });

  it('every other graph kernel gets the default input, and traces the same', () => {
    for (const e of live) {
      const k = kernelOf(e.id);
      const p = defaultParams(k);
      if (e.id === ID) { expect(inputOf(k, p)).toEqual({ maxDuration: 9 }); continue; }
      expect(inputOf(k, p), e.id).toEqual({});
      for (const shape of k.inputs) {
        for (const n of [k.n?.min ?? 8, Math.min(k.n?.value ?? 60, 60)]) {
          const g = graphAt(shape, n, SEED, inputOf(k, p));
          const base = makeGraph(shape, n, SEED);
          const a = trace(k, g, { s: g.s, t: g.t, p }, SEED);
          const b = trace(k, base, { s: base.s, t: base.t, p }, SEED);
          expect(hash([Array.from(a.events.subarray(0, 5 * a.length)), a.counts]), `${e.id} ${shape} n=${n}`)
            .toBe(hash([Array.from(b.events.subarray(0, 5 * b.length)), b.counts]));
        }
      }
    }
  }, 120_000);

  it('every graph plate offers the same controls, the new one aside', () => {
    const defs = live.map((e) => [e.id, plateOf(e.id).params.filter((d) => d.key !== KEY)]);
    expect(hash(defs)).toBe(CONTROLS);
  });

  it('critical-path reads the same at its default', async () => {
    const out: (string | undefined)[] = [];
    for (const readout of ['Project length', 'Critical tasks', 'Critical (no slack)', 'Both passes done', 'Forward pass done']) {
      out.push((await read(ID, claim(readout, {}))).text);
    }
    expect(hash(out), JSON.stringify(out)).toBe(CP_READOUTS);
  });
});
