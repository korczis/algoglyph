// The flow network's largest capacity becomes a control of the four flow plates (wave 7a phase 2,
// C1): the graph engine drew every capacity as int(1, 12); it now draws int(1, maxCapacity) for a
// kernel that declares the control, the same single draw in the same place, so the default 12 is
// the old network (test/controls-graph-engine.test.ts compares every plate with the old engine).
// Checked here: the control exists with the old constant as its default, it travels in a shared
// link, it sets the capacities and nothing else, and it drives what the plates read: at 1 every
// residual room is 0 or 1, so each augmentation of Ford–Fulkerson and Edmonds–Karp carries exactly
// one unit and their rounds equal the flow value; at every setting the flow value is the maximum
// flow of an independent Dinic (test/support/graph-oracles.ts).
import { describe, expect, it } from 'vitest';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import * as G from '../src/engines/graph';
import { makeGraph, type Graph } from '../src/engines/graph/graph';
import { defaultParams, type GraphKernel } from '../src/engines/graph/trace';
import { ENTRIES } from '../src/core/catalogue';
import { read, type Claim } from './support/claims';
import { dinic, successiveShortestPaths } from './support/graph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const kernels = import.meta.glob<GraphKernel>('../src/kernels/graph/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => kernels[`../src/kernels/graph/${id}.ts`];
const plateOf = (id: string) => {
  const e = ENTRIES.find((x) => x.id === id)!;
  return G.engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const KEY = 'maxCapacity';
const PLATES = ['ford-fulkerson', 'edmonds-karp', 'preflow-push', 'min-cost-flow'];
const SEED = 4242;
const defOf = (id: string) => kernelOf(id).params?.find((d) => d.key === KEY) as RangeParam | undefined;
type Input = { maxCapacity?: number };
const flowAt = (n: number, seed: number, input?: Input) =>
  (makeGraph as (s: 'flow', n: number, seed: number, a?: number, i?: Input) => Graph)('flow', n, seed, 16 / 9, input);
const inputOf = (k: GraphKernel, p: Params): Input =>
  (G as unknown as { graphInput: (k: GraphKernel, p: Params) => Input }).graphInput(k, p);
const claim = (readout: string, params: Params, expect: Claim['expect'] = { range: [-1e12, 1e12] }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });

describe('flow plates: largest capacity', () => {
  it('is a range control on each flow plate, the old constant 12 its default', () => {
    for (const id of PLATES) {
      expect(defOf(id), id).toMatchObject({ kind: 'range', min: 1, step: 1, value: 12, rebuild: true });
      expect(defOf(id)!.max, id).toBeGreaterThanOrEqual(100);
      expect(plateOf(id).params.find((x) => x.key === KEY), id).toEqual(defOf(id));
    }
  });

  it('round-trips through a shared link', () => {
    for (const id of PLATES) {
      const defs = plateOf(id).params;
      const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
      for (const v of [1, 99, defOf(id)!.max]) {
        expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7)), `${id} ${v}`).toEqual({ seed: 7, params: { [KEY]: v } });
      }
    }
  });

  it('sets the capacities to 1..maxCapacity and nothing else', () => {
    for (const id of PLATES) expect(inputOf(kernelOf(id), { ...defaultParams(kernelOf(id)), [KEY]: 5 }), id).toEqual({ maxCapacity: 5 });
    for (const c of [1, 5, 12, 100, 1000]) {
      for (const n of [4, 30, 150]) {
        for (const seed of [1, 7, SEED]) {
          const g = flowAt(n, seed, { maxCapacity: c });
          const base = flowAt(n, seed);
          // the same network but its capacities (which the flow input also keeps as weights)
          expect({ ...g, cap: [], w: [] }).toEqual({ ...base, cap: [], w: [] });
          expect(g.w).toEqual(g.cap);
          for (const x of g.cap) { expect(x).toBeGreaterThanOrEqual(1); expect(x).toBeLessThanOrEqual(c); }
          if (c === 12) expect(g).toEqual(base);
        }
      }
    }
    expect(Math.max(...flowAt(150, SEED, { maxCapacity: 1000 }).cap)).toBeGreaterThan(12);
  });

  it('drives the readouts: at 1 the rounds equal the flow; the flow is Dinic\'s at both ends', async () => {
    for (const id of ['ford-fulkerson', 'edmonds-karp']) {
      const r = await read(id, claim('Rounds', { [KEY]: 1 }, { against: 'Flow value', tolerance: 0 }));
      expect(r.reason, id).toBeUndefined();
      expect(r.value, `${id}: rounds − flow at capacity 1`).toBe(0);
    }
    for (const id of PLATES) {
      const n = kernelOf(id).n!.value;
      for (const c of [1, defOf(id)?.max ?? 1000]) {
        const g = flowAt(n, SEED, { maxCapacity: c });
        const flow = await read(id, claim('Flow value', { [KEY]: c }));
        expect(flow.reason, id).toBeUndefined();
        expect(flow.value, `${id} at capacity ${c}`).toBe(dinic(g, g.s, g.t));
        if (id === 'min-cost-flow') {
          const cost = await read(id, claim('Minimum cost', { [KEY]: c }));
          expect(cost.value, `${id} cost at capacity ${c}`).toBe(successiveShortestPaths(g, g.s, g.t).cost);
        }
      }
    }
  });
});
