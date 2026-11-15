// The directed input's reciprocity becomes a control of the strong-component and closure plates
// (wave 7a phase 2, C2): the graph engine gave each edge of the 'digraph' shape its reverse when
// a draw fell below 0.35; for a kernel that declares the control it now compares the same draw
// with `reciprocity`, so the default 0.35 is the old graph (test/controls-graph-engine.test.ts
// compares every plate with the old engine). The signed and negative-cycle shapes draw their
// reverses the same way and keep 0.35 whatever the control says.
// Checked here: the control exists with the old constant as its default, only on the digraph
// input, it travels in a shared link, it adds reverses and nothing else, and it drives the
// readouts: at 1 every edge has its reverse, the input is connected (graph.ts connect), so every
// vertex reaches every other and itself: exactly one strong component, and Warshall writes all n²
// cells of the reachability matrix; both checked against BFS from every vertex
// (test/support/digraph-oracles.ts).
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import * as G from '../src/engines/graph';
import { makeGraph, type Graph, type Shape } from '../src/engines/graph/graph';
import { defaultParams, type GraphKernel } from '../src/engines/graph/trace';
import { read, type Claim } from './support/claims';
import { mutualClasses, reachability } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const kernels = import.meta.glob<GraphKernel>('../src/kernels/graph/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => kernels[`../src/kernels/graph/${id}.ts`];
const plateOf = (id: string) => {
  const e = ENTRIES.find((x) => x.id === id)!;
  return G.engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const KEY = 'reciprocity';
const PLATES = ['kosaraju-scc', 'tarjan-scc', 'transitive-closure'];
const SEED = 4242;
const defOf = (id: string) => kernelOf(id).params?.find((d) => d.key === KEY) as RangeParam | undefined;
type Input = { reciprocity?: number };
const graphAt = (shape: Shape, n: number, seed: number, aspect: number, input?: Input) =>
  (makeGraph as (s: Shape, n: number, seed: number, a?: number, i?: Input) => Graph)(shape, n, seed, aspect, input);
const inputOf = (k: GraphKernel, p: Params): Input =>
  (G as unknown as { graphInput: (k: GraphKernel, p: Params) => Input }).graphInput(k, p);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, number> } });
const pairKey = (g: Graph, e: number) => Math.min(g.eu[e], g.ev[e]) * g.n + Math.max(g.eu[e], g.ev[e]);
const arcs = (g: Graph) => new Set(Array.from({ length: g.m }, (_, e) => g.eu[e] * g.n + g.ev[e]));

describe('strong components and closure: reciprocity of the directed input', () => {
  it('is a range control on the digraph input only, the old constant 0.35 its default', () => {
    for (const id of PLATES) {
      expect(defOf(id), id).toMatchObject({
        kind: 'range', min: 0, max: 1, step: 0.05, value: 0.35, rebuild: true,
        when: { key: 'shape', values: ['digraph'] },
      });
      expect(plateOf(id).params.find((x) => x.key === KEY), id).toEqual(defOf(id));
    }
  });

  it('round-trips through a shared link', () => {
    for (const id of PLATES) {
      const defs = plateOf(id).params;
      const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
      for (const v of [0, 0.5, 1]) {
        expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7)), `${id} ${v}`).toEqual({ seed: 7, params: { [KEY]: v } });
      }
    }
  });

  it('adds reverse edges on the digraph and nothing else; the other directed shapes keep 0.35', () => {
    for (const id of PLATES) expect(inputOf(kernelOf(id), { ...defaultParams(kernelOf(id)), [KEY]: 1 }), id).toEqual({ reciprocity: 1 });
    for (const r of [0, 0.2, 0.35, 0.6, 1]) {
      for (const n of [4, 24, 70, 300]) {
        for (const seed of [1, 7, SEED]) {
          const g = graphAt('digraph', n, seed, 16 / 9, { reciprocity: r });
          const base = graphAt('digraph', n, seed, 16 / 9);
          // the same vertices, the same pairs, the same draws (the vertex weights come after them)
          expect([g.x, g.y, g.vw, g.s, g.t]).toEqual([base.x, base.y, base.vw, base.s, base.t]);
          expect(new Set(Array.from({ length: g.m }, (_, e) => pairKey(g, e))))
            .toEqual(new Set(Array.from({ length: base.m }, (_, e) => pairKey(base, e))));
          const a = arcs(g);
          const both = Array.from({ length: g.m }, (_, e) => a.has(g.ev[e] * g.n + g.eu[e])).filter(Boolean).length;
          if (r === 0) expect(both, `${n} ${seed}`).toBe(0);
          if (r === 1) expect(both, `${n} ${seed}`).toBe(g.m);
          if (r === 0.35) expect(g).toEqual(base);
          for (const shape of ['signed', 'negative-cycle'] as Shape[]) {
            expect(graphAt(shape, n, seed, 16 / 9, { reciprocity: r }), `${shape} ${n} ${seed}`).toEqual(graphAt(shape, n, seed, 16 / 9));
          }
        }
      }
    }
  });

  it('drives the readouts: at 1 one strong component and n² matrix writes', async () => {
    for (const id of ['kosaraju-scc', 'tarjan-scc']) {
      const n = kernelOf(id).n!.value;
      const g = graphAt('digraph', n, SEED, 16 / 9, { reciprocity: 1 });
      expect(new Set(mutualClasses(g)).size, 'BFS from every vertex: one class').toBe(1);
      const r = await read(id, claim('Strong components', { [KEY]: 1 }));
      expect(r.reason, id).toBeUndefined();
      expect(r.value, id).toBe(1);
      // at 0 each pair is one-way: the classes BFS finds, more than one
      const zero = new Set(mutualClasses(graphAt('digraph', n, SEED, 16 / 9, { reciprocity: 0 }))).size;
      expect(zero).toBeGreaterThan(1);
      expect((await read(id, claim('Strong components', { [KEY]: 0 }))).value, id).toBe(zero);
    }
    for (const n of [4, 24, 64]) {
      const g = graphAt('digraph', n, SEED, 1, { reciprocity: 1 });
      expect(reachability(g).flat().every(Boolean), `n ${n}: every pair reachable`).toBe(true);
      const w = await read('transitive-closure', claim('Matrix writes', { [KEY]: 1, n }));
      expect(w.reason).toBeUndefined();
      expect(w.value, `n ${n}`).toBe(g.n * g.n);
    }
  });
});
