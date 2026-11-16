// Engine adapters (RFC §5): each turns every live kernel of one engine into a choice of one
// family node, read from the catalogue. The kernel runs through its engine's own headless runner
// (the grid engine's run, the graph engine's trace) and the node reports what that engine
// measures, so the numbers are the same the plate shows. Nothing here draws, and nothing here
// re-implements a kernel: the kernel is loaded by the registry's loader, as a plate loads it.
import type { Entry } from '../core/catalogue';
import type { ParamDef, Params } from '../core/plate';
import { makeGraph } from '../engines/graph/graph';
import { defaultParams, EVENT_CAP, trace as graphTrace, work as graphWork, type Counts, type GraphKernel } from '../engines/graph/trace';
import { run as gridRun, type GridKernel } from '../engines/grid/trace';
import type { Adapter, KernelLoad } from './derive';
import type { NodeDef } from './node';
import type { RecordValue, SeriesValue } from './types';

/** The size a seeded instance is built at: the kernel's smallest, or the size its plate opens at. */
const SIZE: ParamDef = {
  kind: 'select', key: 'size', label: 'Instance size', value: 'small',
  options: [{ value: 'small', label: 'Smallest the kernel allows' }, { value: 'default', label: 'As its plate opens' }],
};

const kernelParam = (es: readonly Entry[]): ParamDef => ({
  kind: 'select', key: 'kernel', label: 'Kernel', value: es[0]?.id ?? '', options: es.map((e) => ({ value: e.id, label: e.title })),
});

function chosen(es: readonly Entry[], params: Params): Entry {
  const id = String(params.kernel);
  const e = es.find((x) => x.id === id);
  if (!e) throw new Error(`${id} is not a kernel this node runs`);
  return e;
}

const record = (rows: [string, number][]): RecordValue => ({ kind: 'record', rows: rows.map(([label, value]) => ({ label, value, unit: '1' })) });

/** The grid engine: a seeded table or board, filled by the kernel, measured by its own readouts. */
export const gridAdapter: Adapter = {
  engine: 'grid', type: 'grid',
  signature: 'seeded instance in; the kernel\'s own readouts (record) and the cells computed by row (series) out',
  refuse: () => null,
  node: (es: Entry[], load: KernelLoad): NodeDef => ({
    type: 'grid', title: 'Table and board kernel', category: 'provider', seeded: true,
    summary: 'Any kernel of the grid engine on its own seeded instance: dynamic programming, memoisation, backtracking, sieving, counted cell by cell.',
    params: [kernelParam(es), SIZE],
    inputs: [],
    outputs: [
      { id: 'readouts', label: 'Readouts', type: { kind: 'record' } },
      { id: 'rows', label: 'Computed by row', type: { kind: 'series', unit: '1', index: '1' } },
    ],
    run: async ({ params, seed }) => {
      const e = chosen(es, params);
      const k = (await load(e)) as GridKernel;
      const n = params.size === 'default' ? k.size.value : k.size.min;
      const t = gridRun(k, n, seed);
      if (t.truncated) throw new Error(`${e.title}: the run reached the trace's event cap`);
      const readouts = record([[k.size.label, n], ...k.readouts.map((m): [string, number] => [m.name, m.of(t.tally)]), ['Work', t.tally.work]]);
      const rows: SeriesValue = {
        kind: 'series', values: Float64Array.from(t.tally.computedByRow), unit: '1',
        index: { unit: '1', start: 0, step: 1 }, label: `${e.title}: cells computed by row`,
      };
      return { readouts, rows };
    },
  }),
};

const COUNT_LABELS: [keyof Counts, string][] = [
  ['discovers', 'Vertices discovered'], ['settles', 'Vertices settled'], ['scans', 'Edges scanned'],
  ['relaxations', 'Relaxations'], ['improvements', 'Improvements'], ['values', 'Values set'], ['flows', 'Flow updates'],
  ['cells', 'Matrix cells'], ['places', 'Placements'], ['groups', 'Group assignments'], ['rounds', 'Rounds'],
];

/** The graph engine: a seeded graph of the kernel's first input shape, counted by the engine. */
export const graphAdapter: Adapter = {
  engine: 'graph', type: 'graph',
  signature: 'seeded graph in; the engine\'s operation counts (record) out',
  refuse: () => null,
  node: (es: Entry[], load: KernelLoad): NodeDef => ({
    type: 'graph', title: 'Graph kernel', category: 'provider', seeded: true,
    summary: 'Any kernel of the graph engine on a seeded graph of the shape it opens with: searches, shortest paths, flows, trees, communities, counted by the engine.',
    params: [kernelParam(es), SIZE],
    inputs: [],
    outputs: [{ id: 'counts', label: 'Counts', type: { kind: 'record' } }],
    run: async ({ params, seed }) => {
      const e = chosen(es, params);
      const k = (await load(e)) as GraphKernel;
      const n = params.size === 'default' ? (k.n?.value ?? 24) : (k.n?.min ?? 6);
      const g = makeGraph(k.inputs[0], n, seed, 4 / 3);
      const t = graphTrace(k, g, { s: g.s, t: g.t, p: defaultParams(k) }, seed, k.cap ?? EVENT_CAP, false);
      if (t.truncated) throw new Error(`${e.title}: the search stopped at the event cap on this graph`);
      const rows: [string, number][] = [['Vertices', g.n], ['Edges', g.m]];
      for (const [key, label] of COUNT_LABELS) if (t.counts[key] > 0) rows.push([label, t.counts[key]]);
      rows.push(['Work', graphWork(t.counts)]);
      return { counts: record(rows) };
    },
  }),
};
