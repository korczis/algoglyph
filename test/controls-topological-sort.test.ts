// topological-sort takes a cyclic input (wave 7a phase 2, C4): the plate's input select, the
// engine's own way of choosing a kernel's input shape (kernel.inputs), gains the directed shape
// with cycles after its three acyclic ones, so its default stays the layered DAG and every run at
// the default is the old one (test/controls-graph-engine.test.ts). No graph draw changes: the
// digraph shape is drawn as for every other plate that takes it.
// Checked here: the option exists, the DAG stays the default, it travels in a shared link, and it
// drives the readouts: an input with a cycle has no order that puts every edge forward (the
// cycle's vertices take some order, and the edge from the last of them back to an earlier one
// points backward), so "Edges pointing backward" is above 0 on it; the input is shown to be cyclic
// by a breadth-first search from every vertex, independently of the plate's depth-first search.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import * as G from '../src/engines/graph';
import { makeGraph } from '../src/engines/graph/graph';
import type { GraphKernel } from '../src/engines/graph/trace';
import { read, type Claim } from './support/claims';
import { mutualClasses } from './support/digraph-oracles';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'topological-sort';
const kernels = import.meta.glob<GraphKernel>('../src/kernels/graph/[!_]*.ts', { import: 'kernel', eager: true });
const kernel = kernels[`../src/kernels/graph/${ID}.ts`];
const plate = () => {
  const e = ENTRIES.find((x) => x.id === ID)!;
  return G.engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernel);
};
const shapeDef = () => plate().params.find((d) => d.key === 'shape') as SelectParam;
const claim = (readout: string, params: Params, seed = 4242): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, string>, seed } });
/** Whether the graph has a cycle: two vertices that reach each other, by BFS from every vertex. */
const cyclic = (shape: 'digraph', n: number, seed: number) => {
  const cls = mutualClasses(makeGraph(shape, n, seed, 16 / 9));
  return new Set(cls).size < cls.length;
};

describe('topological-sort: a cyclic input', () => {
  it('offers the directed input with cycles, after the acyclic ones; the DAG stays the default', () => {
    expect(kernel.inputs).toEqual(['dag', 'signed-dag', 'reasoning', 'digraph']);
    expect(shapeDef().value).toBe('dag');
    expect(shapeDef().options.map((o) => o.value)).toContain('digraph');
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    expect(parse(defs, serialise(defs, { ...d, shape: 'digraph' }, 7))).toEqual({ seed: 7, params: { shape: 'digraph' } });
  });

  it('drives the readouts: on a cyclic input some edge points backward, every vertex is placed', async () => {
    for (const seed of [4242, 7, 1]) {
      expect(cyclic('digraph', kernel.n!.value, seed), `seed ${seed}: the input has a cycle`).toBe(true);
      const back = await read(ID, claim('Edges pointing backward', { shape: 'digraph' }, seed));
      expect(back.reason).toBeUndefined();
      expect(back.value!, `seed ${seed}`).toBeGreaterThan(0);
      const placed = await read(ID, claim('Placed', { shape: 'digraph' }, seed));
      expect(placed.value, `seed ${seed}: every vertex is placed`).toBe(makeGraph('digraph', kernel.n!.value, seed, 16 / 9).n);
    }
    // and on the DAG, the default, none
    expect((await read(ID, claim('Edges pointing backward', {}))).value).toBe(0);
  });
});
