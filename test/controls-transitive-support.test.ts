// transitive-support's conclusion fan-in becomes a control (S4 C4): the reasoning input gave the
// conclusion round(0.7 × claims below) draws, with replacement, from the claims below it; it now
// gives it round(fanIn × claims below) for the kernel that declares the control (graph.ts
// GraphInput), with the same draws in the same place, so the default 0.7 is the old graph and
// kahn-waves, topological-sort and sugiyama-layout, which share the input, keep it. Checked: the
// control exists with the old constant as its default, it travels in a shared link, it drives
// what the plate reads (a line of support enters the conclusion by its own edge, and the draws
// are with replacement, so 1 ≤ lines ≤ in-degree ≤ round(fanIn × claims below): at 40 vertices
// 18 evidence items, 13 + 8 claims and the conclusion, so at most round(fanIn × 8)), and every
// other graph plate's input and trace are what they were before the control existed (rule 10).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import * as G from '../src/engines/graph';
import { makeGraph, SHAPES, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, trace, type GraphKernel } from '../src/engines/graph/trace';
import type { SupportResult } from '../src/kernels/graph/transitive-support';
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
const ID = 'transitive-support';
const KEY = 'fanIn';
const ts = kernelOf(ID) as GraphKernel<SupportResult>;
/** The plate's default size and the claims' seed (src/core/claims.ts DEFAULT_SEED). */
const N = 40;
const SEED = 4242;
const ASPECT = 16 / 9;
/** The kernels other than this one that draw the reasoning input. */
const SHARERS = ['kahn-waves', 'topological-sort', 'sugiyama-layout'];

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const settings = (d: RangeParam) =>
  Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => +(d.min + i * d.step).toFixed(10));
const defOf = () => ts.params?.find((d) => d.key === KEY) as RangeParam | undefined;
type Input = { maxDuration?: number; fanIn?: number };
const graphAt = (shape: Shape, n: number, seed: number, input?: Input) =>
  (makeGraph as (s: Shape, n: number, seed: number, a?: number, i?: Input) => Graph)(shape, n, seed, ASPECT, input);
/** What the graph plates pass to makeGraph for a kernel's own controls (index.ts). */
const inputOf = (k: GraphKernel, p: Params): Input =>
  (G as unknown as { graphInput: (k: GraphKernel, p: Params) => Input }).graphInput(k, p);

/** The claims right below the conclusion, recounted from the tiers the input is built from:
 * 45% evidence, then 60% of the claims, the rest of the claims, the conclusion. */
function below(n: number): number {
  n = Math.max(2, Math.floor(n));
  const E = Math.max(1, Math.round(n * 0.45));
  const C = Math.max(1, n - E - 1);
  const tiers = [E, Math.ceil(C * 0.6), C - Math.ceil(C * 0.6), 1].filter((k) => k > 0);
  return tiers[tiers.length - 2];
}

const claim = (readout: string, params: Params, expect: Claim['expect'] = { range: [-1e12, 1e12] }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });

describe('transitive-support: conclusion fan-in', () => {
  it('is a range control with the old constant as its default', () => {
    expect(defOf()).toMatchObject({
      kind: 'range', label: 'Conclusion’s draws per claim below', min: 0.05, max: 1, step: 0.05, value: 0.7, rebuild: true,
    });
    expect(plateOf(ID).params.find((x) => x.key === KEY)).toEqual(defOf());
  });

  it('round-trips through a shared link', () => {
    const defs = plateOf(ID).params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0.05, 0.5, 1]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('bounds the conclusion’s in-degree and the lines by round(fanIn × claims below), at every setting', () => {
    expect(defOf(), 'the kernel declares the control').toBeDefined();
    expect(inputOf(ts, { ...defaultParams(ts), [KEY]: 0.5 })).toEqual({ fanIn: 0.5 });
    expect(below(N)).toBe(8);
    let topHit = false;
    for (const f of settings(defOf()!)) {
      for (const n of [4, 12, N, 160]) {
        for (const seed of [1, 7, SEED]) {
          const g = graphAt('reasoning', n, seed, { fanIn: f });
          const base = graphAt('reasoning', n, seed);
          const t = g.n - 1;
          const k = Math.max(1, Math.round(f * below(n)));
          // the conclusion is drawn last: every edge below it is the default graph's
          const lower = (h: Graph) => h.eu.map((u, e) => [u, h.ev[e]]).filter(([, v]) => v !== t);
          expect(lower(g)).toEqual(lower(base));
          expect(g.in[t].length, `f=${f} n=${n} seed=${seed}`).toBeGreaterThanOrEqual(1);
          expect(g.in[t].length).toBeLessThanOrEqual(k);
          const r = trace(ts, g, { s: g.s, t, p: { ...defaultParams(ts), [KEY]: f } }, seed).result!;
          expect(r.lines).toBeGreaterThanOrEqual(1);
          expect(r.lines).toBeLessThanOrEqual(g.in[t].length);
          if (f === 1 && n === 160 && g.in[t].length > Math.round(0.25 * below(n))) topHit = true;
        }
      }
    }
    expect(topHit, 'the top of the range gives the conclusion more supports than a quarter can').toBe(true);
  });

  it('drives the readouts: the lines stay within [1, max(1, round(fanIn × 8))] at 40 vertices', async () => {
    for (const f of [0.05, 0.25, 0.5, 1]) {
      const r = await read(ID, claim('Independent lines of support', { [KEY]: f }));
      expect(r.reason).toBeUndefined();
      expect(r.value!, `fanIn ${f}: ${r.text}`).toBeGreaterThanOrEqual(1);
      expect(r.value!).toBeLessThanOrEqual(Math.max(1, Math.round(f * 8)));
      const g = graphAt('reasoning', N, SEED, { fanIn: f });
      const exact = trace(ts, g, { s: g.s, t: g.t, p: { ...defaultParams(ts), [KEY]: f } }, SEED).result!;
      expect(r.value).toBe(exact.lines);
    }
    // below 1/16 of a draw per claim the conclusion rests on one claim: exactly one line
    const low = await read(ID, claim('Independent lines of support', { [KEY]: 0.05 }));
    expect(low.value).toBe(1);
    const high = await read(ID, claim('Independent lines of support', { [KEY]: 1 }));
    expect(high.value!).toBeGreaterThan(low.value!);
  });
});

describe('the graph engine at the defaults is what it was before the fan-in control', () => {
  // integers only (the reasoning input's edges and vertex weights at every size and seed),
  // recorded on the code before the control existed (5f091c7)
  const REASONING = 'd78a4f4647ccce8d';
  const SIZES = [3, 17, N, 60, 160];
  const SEEDS = [1, SEED];

  it('the reasoning input draws the same edges and weights', () => {
    const all = SIZES.flatMap((n) => SEEDS.map((seed) => {
      const g = makeGraph('reasoning', n, seed);
      return [n, seed, g.eu, g.ev, g.vw];
    }));
    expect(hash(all)).toBe(REASONING);
  });

  it('every shape draws the same graph with the default passed explicitly', () => {
    for (const shape of SHAPES) for (const n of SIZES) for (const seed of SEEDS) {
      expect(graphAt(shape, n, seed, { fanIn: 0.7 }), `${shape} n=${n} seed=${seed}`).toEqual(graphAt(shape, n, seed));
    }
  });

  it('the kernels sharing the reasoning input get the default input, and trace the same', () => {
    for (const id of SHARERS) {
      const k = kernelOf(id);
      const p = defaultParams(k);
      expect(k.inputs).toContain('reasoning');
      expect(inputOf(k, p), id).toEqual({});
      for (const n of [k.n?.min ?? 8, N, Math.min(k.n?.max ?? 160, 160)]) {
        for (const seed of SEEDS) {
          const g = graphAt('reasoning', n, seed, inputOf(k, p));
          const base = graphAt('reasoning', n, seed, { fanIn: 0.7 });
          const a = trace(k, g, { s: g.s, t: g.t, p }, seed);
          const b = trace(k, base, { s: base.s, t: base.t, p }, seed);
          expect(hash([Array.from(a.events.subarray(0, 5 * a.length)), a.counts]), `${id} n=${n}`)
            .toBe(hash([Array.from(b.events.subarray(0, 5 * b.length)), b.counts]));
        }
      }
    }
    expect(live.filter((e) => kernelOf(e.id).inputs.includes('reasoning')).map((e) => e.id).sort())
      .toEqual([...SHARERS, ID].sort());
  });

  it('transitive-support reads the same at its default', async () => {
    const out: (string | undefined)[] = [];
    for (const readout of ['Independent lines of support', 'Evidence under the conclusion']) {
      out.push((await read(ID, claim(readout, {}))).text);
      if (defOf()) expect((await read(ID, claim(readout, { [KEY]: 0.7 }))).text).toBe(out.at(-1));
    }
    expect(out).toEqual(['4', '11 items, 22 supporting vertices']);
  });
});
