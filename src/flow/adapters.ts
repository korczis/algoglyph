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
import { DEFAULT_SHAPES, makeInput } from '../engines/geometry/input';
import { DEFAULT_N, record as record_, type GeometryKernel } from '../engines/geometry/trace';
import type { NumericKernel } from '../engines/numeric/trace';
import { defaultParams as systemsDefaults, simulate, total as systemsTotal, type SystemsKernel } from '../engines/systems/sim';
import { trace as stochasticTrace, type StochasticKernel } from '../engines/stochastic/trace';
import { Meter as SignalMeter, type SignalKernel, type View as SignalView } from '../engines/signal/trace';
import { trace as hashTrace, type Counts as HashCounts, type HashKernel } from '../engines/hash/table';
import { PLATE as HASH_PLATE, workload as hashWorkload } from '../engines/hash/workload';
import { input as stringInput, KINDS as STRING_KINDS } from '../engines/string/inputs';
import { trace as stringTrace, type StringKernel } from '../engines/string/trace';
import { SHAPES as TREE_SHAPES, SIZE as TREE_SIZE, trace as treeTrace, workload, type Counts as TreeCounts, type TreeKernel } from '../engines/tree/trace';
import type { Adapter, KernelLoad } from './derive';
import type { NodeDef } from './node';
import type { PointsValue, RecordValue, SeriesValue } from './types';

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

/** A kernel's own parameters at their defaults: what shapes its input, as its plate reads them. */
const defaults = (ps: readonly ParamDef[] | undefined): Record<string, number> =>
  Object.fromEntries((ps ?? []).map((d) => [d.key, Number(d.value)]));

const TREE_LABELS: [keyof TreeCounts, string][] = [
  ['compares', 'Key comparisons'], ['digits', 'Digit tests'], ['visits', 'Node visits'], ['links', 'Links set'],
  ['rotations', 'Rotations'], ['splits', 'Splits'], ['recolours', 'Recolourings'], ['nodes', 'Nodes allocated'],
  ['reads', 'Array reads'], ['writes', 'Array writes'],
];

/** The tree engine: a seeded workload of the kernel's input kind, built and searched, counted. */
export const treeAdapter: Adapter = {
  engine: 'tree', type: 'tree',
  signature: 'seeded workload in; the engine\'s operation counts (record) out',
  refuse: () => null,
  node: (es: Entry[], load: KernelLoad): NodeDef => ({
    type: 'tree', title: 'Tree and heap kernel', category: 'provider', seeded: true,
    summary: 'Any kernel of the tree engine on its own seeded workload: search trees, heaps, tries, forests and codes, every operation counted.',
    params: [kernelParam(es), SIZE],
    inputs: [],
    outputs: [{ id: 'counts', label: 'Counts', type: { kind: 'record' } }],
    run: async ({ params, seed }) => {
      const e = chosen(es, params);
      const k = (await load(e)) as TreeKernel;
      const size = TREE_SIZE[k.input];
      const n = params.size === 'default' ? size.value : size.min;
      const t = treeTrace(k, workload(k.input, TREE_SHAPES[k.input][0].value, n, seed, defaults(k.params)), false);
      if (t.truncated) throw new Error(`${e.title}: the run reached the trace's event cap`);
      const rows: [string, number][] = [[size.label, n]];
      for (const [key, label] of TREE_LABELS) if (t.counts[key] > 0) rows.push([label, t.counts[key]]);
      return { counts: record(rows) };
    },
  }),
};

/** The string engine: a seeded text, list or table of the kernel's input kind, counted by its own counters. */
export const stringAdapter: Adapter = {
  engine: 'string', type: 'text',
  signature: 'seeded input in; the kernel\'s own counters (record) out',
  refuse: () => null,
  node: (es: Entry[], load: KernelLoad): NodeDef => ({
    type: 'text', title: 'String and text kernel', category: 'provider', seeded: true,
    summary: 'Any kernel of the string engine on its own seeded input: matching, edit distance, compression, record linkage, counted by its own counters.',
    params: [kernelParam(es), SIZE],
    inputs: [],
    outputs: [{ id: 'counts', label: 'Counts', type: { kind: 'record' } }],
    run: async ({ params, seed }) => {
      const e = chosen(es, params);
      const k = (await load(e)) as StringKernel;
      const def = STRING_KINDS[k.input];
      const n = params.size === 'default' ? (k.size ?? def.size.value) : def.size.min;
      const opts = Object.fromEntries((k.params ?? []).map((d) => [d.key, d.value]));
      const x = stringInput(k.input, n, k.shape ?? def.shapes[0]?.value ?? '', seed, opts as never);
      const t = stringTrace(k, x as never, opts);
      if (t.truncated) throw new Error(`${e.title}: the run reached the trace's event cap`);
      return { counts: record([[def.size.label, n], ...t.labels.map((label, i): [string, number] => [label, t.counts[i]])]) };
    },
  }),
};

const HASH_LABELS: [keyof HashCounts, string][] = [
  ['hashes', 'Hashes'], ['probes', 'Probes'], ['writes', 'Writes'], ['removes', 'Removals'], ['rehashes', 'Rehashes'],
  ['rehashed', 'Keys rehashed'], ['loads', 'Page loads'], ['splits', 'Splits'], ['doublings', 'Directory doublings'], ['dirReads', 'Directory reads'],
];

/** The hash engine: the shared workload (insert, search, delete) on uniform seeded keys, counted. */
export const hashAdapter: Adapter = {
  engine: 'hash', type: 'hash',
  signature: 'seeded key workload in; the engine\'s operation counts (record) out',
  refuse: () => null,
  node: (es: Entry[], load: KernelLoad): NodeDef => ({
    type: 'hash', title: 'Hash table kernel', category: 'provider', seeded: true,
    summary: 'Any kernel of the hash engine on the workload every hash plate runs: uniform seeded keys inserted, searched and partly deleted, every probe counted.',
    params: [kernelParam(es), SIZE],
    inputs: [],
    outputs: [{ id: 'counts', label: 'Counts', type: { kind: 'record' } }],
    run: async ({ params, seed }) => {
      const e = chosen(es, params);
      const k = (await load(e)) as HashKernel;
      const n = params.size === 'default' ? HASH_PLATE.n : HASH_PLATE.nMin;
      // as the plate sizes it: a fixed-size table filled to its load factor, a self-sizing one given n slots
      const ld = k.maxLoad === undefined ? 100 : Math.min(HASH_PLATE.load, k.maxLoad);
      const size = { n, m: Math.max(1, Math.ceil(n / (ld / 100))), pageSize: HASH_PLATE.page, opts: Object.fromEntries((k.params ?? []).map((d) => [d.key, d.value])) };
      const t = hashTrace(k, hashWorkload('uniform', n, HASH_PLATE.deletes, seed), size);
      if (t.truncated) throw new Error(`${e.title}: the run reached the trace's event cap`);
      const rows: [string, number][] = [['Keys inserted', n]];
      for (const [key, label] of HASH_LABELS) if (t.counts[key] > 0) rows.push([label, t.counts[key]]);
      return { counts: record(rows) };
    },
  }),
};

/** The signal engine: the kernel's run on its own seeded signal, at its parameters' defaults, counted. */
export const signalAdapter: Adapter = {
  engine: 'signal', type: 'dsp',
  signature: 'seeded signal in; the counts the kernel\'s meter recorded over its whole run (record) out',
  refuse: () => null,
  node: (es: Entry[], load: KernelLoad): NodeDef => ({
    type: 'dsp', title: 'Signal processing kernel', category: 'provider', seeded: true,
    summary: 'Any kernel of the signal engine run to its end on its own seeded signal: transforms, filters, codecs and estimators, every multiply and frame metered.',
    params: [kernelParam(es)],
    inputs: [],
    outputs: [{ id: 'counts', label: 'Counts', type: { kind: 'record' } }],
    run: async ({ params, seed, signal }) => {
      const e = chosen(es, params);
      const k = (await load(e)) as SignalKernel;
      const meter = new SignalMeter();
      let last: SignalView | null = null;
      let views = 0;
      for (const v of k.run(Object.fromEntries((k.params ?? []).map((d) => [d.key, d.value])), seed, meter)) {
        if (signal.aborted) throw new Error('superseded');
        if (v) { last = v; views++; }
      }
      if (!last) throw new Error(`${e.title} recorded no view`);
      const counts = meter.snapshot();
      return { counts: record([['Views recorded', views], ...Object.entries(counts).map(([label, value]): [string, number] => [label, value])]) };
    },
  }),
};

/** The stochastic engine: the kernel run to its end on a seeded generator, its draws, evaluations and chart. */
export const stochasticAdapter: Adapter = {
  engine: 'stochastic', type: 'mc',
  signature: 'seeded generator in; draws and model evaluations counted (record) and the run\'s own chart series (points) out',
  refuse: () => null,
  node: (es: Entry[], load: KernelLoad): NodeDef => ({
    type: 'mc', title: 'Stochastic kernel', category: 'provider', seeded: true,
    summary: 'Any kernel of the stochastic engine run to its end on the graph\'s seed: Monte Carlo, sampling, estimation and optimisation, every draw and evaluation counted.',
    params: [kernelParam(es)],
    inputs: [],
    outputs: [
      { id: 'counts', label: 'Counts', type: { kind: 'record' } },
      { id: 'series', label: 'Chart series', type: { kind: 'points', x: '1', y: '1' } },
    ],
    run: async ({ params, seed }) => {
      const e = chosen(es, params);
      const k = (await load(e)) as StochasticKernel;
      const t = stochasticTrace(k, {}, seed);
      const last = t.frames[t.frames.length - 1];
      const named = last?.series ?? [];
      const pick = named.find(([n]) => n === k.labSeries) ?? named[0];
      const pts = pick ? pick[1].slice(0, pick[2]) : [];
      return {
        counts: record([['Uniform draws', t.draws], ['Model evaluations', t.evals], ['Frames recorded', t.frames.length]]),
        series: { kind: 'points', xs: Float64Array.from(pts, (p) => p[0]), ys: Float64Array.from(pts, (p) => p[1]), x: '1', y: '1' } as PointsValue,
      };
    },
  }),
};

/** The numeric engine: a kernel's lab probe, the measured series its lab charts, on the graph's seed. */
export const numericAdapter: Adapter = {
  engine: 'numeric', type: 'probe',
  signature: 'seeded run in; the kernel\'s own measured series (points) and their sizes (record) out',
  // a numeric kernel measures a series exactly when it takes part in a lab: the lab charts its probe
  refuse: (e) => (e.labs.length ? null : 'takes part in no lab, so its kernel measures no series; its run returns a drawing and formatted readouts only'),
  node: (es: Entry[], load: KernelLoad): NodeDef => ({
    type: 'probe', title: 'Numeric kernel probe', category: 'provider', seeded: true,
    summary: 'Any numeric kernel that takes part in a lab, measured as its lab measures it: an error, a cost or a convergence curve, point by point.',
    params: [kernelParam(es)],
    inputs: [],
    outputs: [
      { id: 'series', label: 'First measured series', type: { kind: 'points', x: '1', y: '1' } },
      { id: 'sizes', label: 'Series', type: { kind: 'record' } },
    ],
    run: async ({ params, seed }) => {
      const e = chosen(es, params);
      const k = (await load(e)) as NumericKernel;
      if (!k.probe) throw new Error(`${e.title} declares no probe`);
      const measured = k.probe.measure({ seed, params: Object.fromEntries((k.params ?? []).map((d) => [d.key, d.value])) });
      const first = measured[0]?.points ?? [];
      return {
        series: { kind: 'points', xs: Float64Array.from(first, (p) => p[0]), ys: Float64Array.from(first, (p) => p[1]), x: '1', y: '1' } as PointsValue,
        sizes: record(measured.map((m): [string, number] => [`${m.name}: points`, m.points.length])),
      };
    },
  }),
};

/** The systems engine: a kernel's scenario simulated to its horizon on the graph's seed, measured by its readouts. */
export const systemsAdapter: Adapter = {
  engine: 'systems', type: 'protocol',
  signature: 'seeded simulated network in; the kernel\'s own readouts over the whole run (record) out',
  refuse: () => null,
  node: (es: Entry[], load: KernelLoad): NodeDef => ({
    type: 'protocol', title: 'Distributed systems kernel', category: 'provider', seeded: true,
    summary: 'Any kernel of the systems engine simulated to its horizon on a seeded network: consensus, replication, clocks and queues, measured by its own readouts.',
    params: [kernelParam(es)],
    inputs: [],
    outputs: [{ id: 'readouts', label: 'Readouts', type: { kind: 'record' } }],
    run: async ({ params, seed }) => {
      const e = chosen(es, params);
      const k = (await load(e)) as SystemsKernel;
      const run = simulate(k, systemsDefaults(k), seed);
      const gauges = new Map<string, number>();
      for (const ev of run.net.events) if (ev.k === 'gauge') gauges.set(ev.key, ev.value);
      return { readouts: record(k.readouts.map((r): [string, number] => [r.label, r.kind === 'gauge' ? gauges.get(r.key) ?? NaN : systemsTotal(run.net, r.key)])) };
    },
  }),
};

/** The geometry engine: the kernel's default input shape at its plate's size, every primitive counted. */
export const geometryAdapter: Adapter = {
  engine: 'geometry', type: 'geometry',
  signature: 'seeded input of the kernel\'s kind in; its own counters (record) out',
  refuse: () => null,
  node: (es: Entry[], load: KernelLoad): NodeDef => ({
    type: 'geometry', title: 'Computational geometry kernel', category: 'provider', seeded: true,
    summary: 'Any kernel of the geometry engine on a seeded input of the shape its plate opens with: hulls, triangulations, sweeps and nearest neighbours, every primitive counted.',
    params: [kernelParam(es), SIZE],
    inputs: [],
    outputs: [{ id: 'counts', label: 'Counts', type: { kind: 'record' } }],
    run: async ({ params, seed }) => {
      const e = chosen(es, params);
      const k = (await load(e)) as GeometryKernel;
      const size = k.n ?? DEFAULT_N;
      const n = params.size === 'default' ? size.value : size.min;
      const own = Object.fromEntries((k.params ?? []).map((d) => [d.key, d.value]));
      const shape = (k.shapes ?? DEFAULT_SHAPES[k.input])[0];
      const t = record_(k, makeInput(k.input, shape, n, seed, own), own, seed, false);
      return { counts: record([['Size', n], ...k.counters.map(([key, label]): [string, number] => [label, t.counts[key] ?? 0])]) };
    },
  }),
};
