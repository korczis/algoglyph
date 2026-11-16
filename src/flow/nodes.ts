// The node library (RFC §3). Every node that computes runs code that already exists in the
// collection: the array engine's instrumented trace() runs any live array kernel the catalogue
// lists, the FFT is the signal kernels' shared radix-2 transform, the fit is the least-squares
// plate's Householder QR, a table is read by the shared validator of src/core/data.ts. Nothing
// here re-implements an algorithm a plate already has; the nodes adapt inputs and outputs.
import { ENTRIES, type Entry } from '../core/catalogue';
import { parseData, type DataDecl } from '../core/data';
import type { ParamDef, Params } from '../core/plate';
import { mulberry32 } from '../core/random';
import { input, SHAPE_LABELS, SHAPES, trace, type ArrayKernel, type Shape } from '../engines/array/trace';
import { lstsq, polyval, vandermonde } from '../kernels/numeric/_linalg';
import { fft, nextPow2 } from '../kernels/signal/_fft';
import { kernelLoader } from '../registry';
import { deriveNodes, type Adapter, type KernelLoad } from './derive';
import { gridAdapter, graphAdapter, hashAdapter, stringAdapter, treeAdapter } from './adapters';
import { registry, Wait, type AnyNodeDef, type NodeDef, type Registry } from './node';
import type { PointsValue, PortType, RecordValue, SeriesValue, TableValue, Unit } from './types';

const n = (p: Params, k: string) => Number(p[k]);
const series = (values: Float64Array, unit: Unit, index: SeriesValue['index'], label: string): SeriesValue =>
  ({ kind: 'series', values, unit, index, label });
const range = (key: string, label: string, min: number, max: number, step: number, value: number, hint?: string): ParamDef =>
  ({ kind: 'range', key, label, min, max, step, value, ...(hint ? { hint } : {}) });

// ---- providers ---------------------------------------------------------------------------------

const keys: NodeDef = {
  type: 'keys', title: 'Seeded keys', category: 'provider', seeded: true,
  summary: 'The sorting plates\' own inputs: n keys of a chosen shape, from the graph\'s seed.',
  params: [
    { kind: 'select', key: 'shape', label: 'Shape', value: 'random', options: SHAPES.map((s) => ({ value: s, label: SHAPE_LABELS[s] })) },
    range('n', 'Keys', 8, 1024, 8, 64),
  ],
  inputs: [],
  outputs: [{ id: 'keys', label: 'Keys', type: { kind: 'series', unit: '1', index: '1' } }],
  run: ({ params, seed }) => ({
    keys: series(Float64Array.from(input(params.shape as Shape, n(params, 'n'), seed)), '1', { unit: '1', start: 0, step: 1 }, 'keys'),
  }),
};

const signal: NodeDef = {
  type: 'signal', title: 'Sampled signal', category: 'provider', seeded: true,
  summary: 'Two sines and seeded white noise, sampled at a fixed rate: a time series in seconds.',
  params: [
    range('f1', 'First tone', 1, 120, 1, 12, 'Hz'),
    range('f2', 'Second tone', 1, 120, 1, 40, 'Hz'),
    range('a2', 'Second amplitude', 0, 1, 0.05, 0.5),
    range('noise', 'Noise', 0, 1, 0.05, 0.2, 'standard deviation of the added noise'),
    { kind: 'select', key: 'rate', label: 'Sample rate', value: '512', options: ['256', '512', '1024'].map((v) => ({ value: v, label: `${v} Hz` })) },
    { kind: 'select', key: 'samples', label: 'Samples', value: '512', options: ['128', '256', '512', '1024', '2048'].map((v) => ({ value: v, label: v })) },
  ],
  inputs: [],
  outputs: [{ id: 'signal', label: 'Signal', type: { kind: 'series', unit: '1', index: 's' } }],
  run: ({ params, seed }) => {
    const rate = n(params, 'rate');
    const len = n(params, 'samples');
    const rnd = mulberry32(seed);
    const v = new Float64Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      // Box–Muller from the seeded stream, so the noise is the same for one seed
      const g = Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-12))) * Math.cos(2 * Math.PI * rnd());
      v[i] = Math.sin(2 * Math.PI * n(params, 'f1') * t) + n(params, 'a2') * Math.sin(2 * Math.PI * n(params, 'f2') * t) + n(params, 'noise') * g;
    }
    return { signal: series(v, '1', { unit: 's', start: 0, step: 1 / rate }, 'signal') };
  },
};

/** An approved table schema: the columns a reader confirmed, each with its unit. */
export interface Schema { columns: { key: string; unit: Unit }[] }

const KEY = /^[a-z][a-z0-9_]{0,23}$/;
const UNIT = /^[A-Za-z0-9/^·*%°µ.-]{1,12}$/;

/** Check a proposed schema; null when it may be approved. */
export function schemaError(raw: unknown): string | null {
  const cols = (raw as Schema | undefined)?.columns;
  if (!Array.isArray(cols) || cols.length < 1 || cols.length > 8) return 'a schema has from 1 to 8 columns';
  const seen = new Set<string>();
  for (const c of cols) {
    if (!c || typeof c.key !== 'string' || !KEY.test(c.key)) return `column key ${String(c?.key)} must match ${KEY.source}`;
    if (typeof c.unit !== 'string' || !UNIT.test(c.unit)) return `column ${c.key}: unit ${String(c.unit)} is not a unit (use 1 for a pure number)`;
    if (seen.has(c.key)) return `column ${c.key} is named twice`;
    seen.add(c.key);
  }
  return null;
}

/**
 * A schema inferred from a CSV's header: a proposal only. Keys come from the header; units
 * cannot be read from data, so every unit is proposed as `1` and the reader must confirm or
 * change them before the table is read (RFC §5: inferred never becomes declared by itself).
 */
export function inferSchema(text: string): Schema | string {
  const head = text.split(/\r?\n/, 1)[0] ?? '';
  const names = head.split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, ''));
  if (!names.length || names.some((x) => !x)) return 'the first line must be a header of column names';
  const columns = names.map((x) => ({ key: /^[a-z]/.test(x) ? x.slice(0, 24) : `c_${x}`.slice(0, 24), unit: '1' }));
  const why = schemaError({ columns });
  return why ?? { columns };
}

export const TABLE_LIMITS = { bytes: 256 * 1024, rows: 4096 } as const;

/** The DataDecl an approved schema stands for: the shared parser reads with it. */
export function declOf(s: Schema): DataDecl {
  return {
    id: 'flow', title: 'Table', kind: 'table', accepts: ['csv'], columns: s.columns.map((c) => ({ key: c.key, unit: c.unit })),
    rows: { min: 2, max: TABLE_LIMITS.rows }, bytes: TABLE_LIMITS.bytes, replaces: '', url_bytes: 0,
  };
}

const csv: NodeDef<Schema | null> = {
  type: 'csv', title: 'Table (CSV)', category: 'provider',
  summary: 'A reader\'s own table, read in this tab by the shared validator. It never leaves the page and no link carries it.',
  params: [],
  inputs: [],
  outputs: [{ id: 'table', label: 'Table', type: { kind: 'table' } }],
  side: { label: 'CSV text', bytes: TABLE_LIMITS.bytes },
  state: {
    initial: () => null,
    parse: (raw) => (raw === null ? null : schemaError(raw) ?? { columns: (raw as Schema).columns.map((c) => ({ key: c.key, unit: c.unit })) }),
  },
  intents: {
    schema: {
      label: 'Approve schema',
      validate: (_s, payload) => schemaError(payload),
      apply: (_s, payload) => ({ columns: (payload as Schema).columns.map((c) => ({ key: c.key, unit: c.unit })) }),
    },
  },
  infer: ({ state }): Record<string, PortType> => (state ? { table: { kind: 'table', columns: state.columns } } : {}),
  run: ({ state, side }) => {
    if (!side) throw new Wait('attach a CSV');
    if (!state) throw new Wait('approve the schema: its units are yours to declare');
    const r = parseData(declOf(state), side, 'csv');
    if (!r.ok) throw new Error(r.errors.map((e) => `${e.row !== undefined ? `row ${e.row} ` : ''}${e.col ? `column ${e.col}: ` : ''}${e.reason}`).slice(0, 3).join('; '));
    const t = r.table;
    const table: TableValue = { kind: 'table', keys: t.columns.map((c) => c.key), units: t.columns.map((c) => c.unit), columns: t.values, rows: t.rows, digest: t.digest };
    return { table };
  },
};

/** Points a reader moves: canonical state of this node, changed only by its intents. */
export interface PointSet { pts: [number, number][] }

export const POINT_BOX = { x: [-1, 1], y: [-1.5, 1.5], min: 2, max: 64 } as const;

const inBox = (x: unknown, y: unknown) => typeof x === 'number' && typeof y === 'number'
  && Number.isFinite(x) && Number.isFinite(y)
  && x >= POINT_BOX.x[0] && x <= POINT_BOX.x[1] && y >= POINT_BOX.y[0] && y <= POINT_BOX.y[1];

function initialPoints(): PointSet {
  const rnd = mulberry32(20261115);
  return {
    pts: Array.from({ length: 12 }, (_, i) => {
      const x = -0.9 + (1.8 * i) / 11;
      return [Number(x.toFixed(3)), Number((0.8 * x * x - 0.3 + 0.25 * (rnd() - 0.5)).toFixed(3))] as [number, number];
    }),
  };
}

const points: NodeDef<PointSet> = {
  type: 'points', title: 'Points', category: 'provider',
  summary: 'A point set you edit by dragging it in a scatter view: the canonical state the fit reads.',
  params: [],
  inputs: [],
  outputs: [{ id: 'points', label: 'Points', type: { kind: 'points', x: '1', y: '1' } }],
  state: {
    initial: initialPoints,
    parse: (raw) => {
      const pts = (raw as PointSet | undefined)?.pts;
      if (!Array.isArray(pts) || pts.length < POINT_BOX.min || pts.length > POINT_BOX.max) return `a point set has ${POINT_BOX.min} to ${POINT_BOX.max} points`;
      if (!pts.every((p) => Array.isArray(p) && p.length === 2 && inBox(p[0], p[1]))) return 'every point lies inside the box';
      return { pts: pts.map((p) => [p[0], p[1]] as [number, number]) };
    },
  },
  intents: {
    move: {
      label: 'Move a point',
      validate: (s, raw) => {
        const p = raw as { i?: unknown; x?: unknown; y?: unknown };
        if (!Number.isInteger(p?.i) || (p.i as number) < 0 || (p.i as number) >= s.pts.length) return 'no such point';
        return inBox(p.x, p.y) ? null : 'a point stays inside the box';
      },
      apply: (s, raw) => {
        const p = raw as { i: number; x: number; y: number };
        return { pts: s.pts.map((q, j) => (j === p.i ? [p.x, p.y] : q)) };
      },
    },
    add: {
      label: 'Add a point',
      validate: (s, raw) => {
        const p = raw as { x?: unknown; y?: unknown };
        if (s.pts.length >= POINT_BOX.max) return `at most ${POINT_BOX.max} points`;
        return inBox(p?.x, p?.y) ? null : 'a point stays inside the box';
      },
      apply: (s, raw) => ({ pts: [...s.pts, [(raw as { x: number }).x, (raw as { y: number }).y]] }),
    },
    remove: {
      label: 'Remove a point',
      validate: (s, raw) => {
        const i = (raw as { i?: unknown })?.i;
        if (!Number.isInteger(i) || (i as number) < 0 || (i as number) >= s.pts.length) return 'no such point';
        return s.pts.length > POINT_BOX.min ? null : `at least ${POINT_BOX.min} points`;
      },
      apply: (s, raw) => ({ pts: s.pts.filter((_, j) => j !== (raw as { i: number }).i) }),
    },
  },
  run: ({ state, nodeId }) => ({
    points: {
      kind: 'points', xs: Float64Array.from(state.pts, (p) => p[0]), ys: Float64Array.from(state.pts, (p) => p[1]),
      x: '1', y: '1', owner: nodeId, label: 'points',
    } satisfies PointsValue,
  }),
};

// ---- processors --------------------------------------------------------------------------------

const column: NodeDef = {
  type: 'column', title: 'Column', category: 'processor',
  summary: 'One column of a table as a series, in the unit its approved schema gives it.',
  params: [range('index', 'Column', 1, 8, 1, 1, 'its position in the schema')],
  inputs: [{ id: 'table', label: 'Table', type: { kind: 'table' }, required: true }],
  outputs: [{ id: 'series', label: 'Series', type: { kind: 'series', unit: '$C', index: '1' } }],
  infer: ({ params, inputs }): Record<string, PortType> | string => {
    const t = inputs.table;
    if (!t || t.kind !== 'table' || !t.columns) return {};
    const c = t.columns[n(params, 'index') - 1];
    if (!c) return `the table has ${t.columns.length} column(s), not ${n(params, 'index')}`;
    return { series: { kind: 'series', unit: c.unit, index: '1' } };
  },
  run: ({ params, inputs }) => {
    const t = inputs.table as TableValue;
    const i = n(params, 'index') - 1;
    if (i >= t.keys.length) throw new Error(`the table has ${t.keys.length} column(s)`);
    return { series: series(t.columns[i].slice(), t.units[i], { unit: '1', start: 1, step: 1 }, t.keys[i]) };
  },
};

const normalize: NodeDef = {
  type: 'normalize', title: 'Min–max normalize', category: 'processor',
  summary: 'Maps a series onto [0, 1]: the explicit conversion that turns any unit into a pure number.',
  params: [],
  inputs: [{ id: 'in', label: 'Series', type: { kind: 'series', unit: '$U', index: '$I' }, required: true }],
  outputs: [{ id: 'out', label: 'Normalized', type: { kind: 'series', unit: '1', index: '$I' } }],
  run: ({ inputs }) => {
    const s = inputs.in as SeriesValue;
    let lo = Infinity; let hi = -Infinity;
    for (const v of s.values) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const w = hi - lo;
    return { out: series(s.values.map((v) => (w > 0 ? (v - lo) / w : 0)), '1', s.index, `${s.label} normalized`) };
  },
};

/** Selection kernels place one key; the sort node's sorted output would misstate them. */
const SELECTION = 'sorting/selection';

const loadKernel: KernelLoad = (e) => kernelLoader(e)();

/**
 * The array engine's adapter: every live array kernel that sorts is a choice of the sort node,
 * derived from the catalogue (RFC §5); a selection kernel is refused with its reason.
 */
export const arrayAdapter: Adapter = {
  engine: 'array', type: 'sort',
  signature: 'keys (series) in; sorted keys by rank (series) and the trace\'s counts (record) out',
  refuse: (e) => (e.taxonomy.startsWith(SELECTION) ? 'a selection kernel places one key; the sort node has no port for k or for the key it selects' : null),
  node: (es, load) => sortNode(es, load),
};

/** The sort node over the given kernels (the array adapter derives them from the catalogue). */
export function sortNode(choices: readonly Entry[], load: KernelLoad = loadKernel): NodeDef {
  const first = choices.find((e) => e.id === 'quicksort') ?? choices[0];
  return {
    type: 'sort', title: 'Sort', category: 'processor',
    summary: 'Any sorting kernel of the collection, run by the array engine\'s instrumented trace: every compare and write counted.',
    params: [{ kind: 'select', key: 'kernel', label: 'Kernel', value: first?.id ?? '', options: choices.map((e) => ({ value: e.id, label: e.title })) }],
    inputs: [{ id: 'in', label: 'Keys', type: { kind: 'series', unit: '$U', index: '$I' }, required: true }],
    // sorted keys are indexed by rank, not by the axis they came on
    outputs: [
      { id: 'sorted', label: 'Sorted', type: { kind: 'series', unit: '$U', index: '1' } },
      { id: 'counts', label: 'Counts', type: { kind: 'record' } },
    ],
    run: async ({ params, inputs }) => {
      const id = String(params.kernel);
      const e = choices.find((x) => x.id === id);
      if (!e) throw new Error(`${id} is not a sorting kernel of the catalogue`);
      const s = inputs.in as SeriesValue;
      const keys = Array.from(s.values);
      if (e.tags.includes('non-comparison') && !keys.every((v) => Number.isInteger(v) && v >= 0)) {
        throw new Error(`${e.title} sorts non-negative integer keys; these are not (normalize them first, or pick a comparison sort)`);
      }
      const k = (await load(e)) as ArrayKernel;
      if (k.goal === 'select') throw new Error(`${e.title} selects one key, it does not sort`);
      if (k.maxN !== undefined && keys.length > k.maxN) throw new Error(`${e.title} plays at most ${k.maxN} keys, these are ${keys.length}`);
      const t = trace(k, keys);
      if (t.truncated) throw new Error(`${e.title}: the run reached the trace's event cap`);
      const counts: RecordValue = {
        kind: 'record',
        rows: [
          { label: 'Compares', value: t.counts.compares, unit: '1' },
          { label: 'Writes', value: t.counts.writes, unit: '1' },
          { label: 'Swaps', value: t.counts.swaps, unit: '1' },
          { label: 'Reads', value: t.counts.reads, unit: '1' },
          { label: 'Auxiliary writes', value: t.counts.auxWrites, unit: '1' },
        ],
      };
      return { sorted: series(Float64Array.from(t.output), s.unit, { unit: '1', start: 1, step: 1 }, `${s.label} by ${e.title}`), counts };
    },
  };
}

const spectrum: NodeDef = {
  type: 'fft', title: 'Magnitude spectrum', category: 'processor', entry: 'fft-butterfly',
  summary: 'The radix-2 FFT of the signal plates: a time series in seconds becomes a one-sided spectrum in hertz.',
  params: [{ kind: 'toggle', key: 'pad', label: 'Zero-pad to a power of two', value: true }],
  inputs: [{ id: 'in', label: 'Signal', type: { kind: 'series', unit: '$U', index: 's' }, required: true }],
  outputs: [{ id: 'out', label: 'Spectrum', type: { kind: 'series', unit: '$U', index: 'Hz' } }],
  run: ({ params, inputs }) => {
    const s = inputs.in as SeriesValue;
    const len = s.values.length;
    const N = nextPow2(len);
    if (N !== len && params.pad !== true) throw new Error(`${len} samples is not a power of two; allow zero-padding or resample`);
    const re = new Float64Array(N); re.set(s.values);
    const im = new Float64Array(N);
    fft(re, im);
    const half = N / 2;
    const mag = new Float64Array(half + 1);
    // one-sided amplitude: |X_k| · 2 / len, with DC and Nyquist counted once
    for (let k = 0; k <= half; k++) mag[k] = (Math.hypot(re[k], im[k]) * (k === 0 || k === half ? 1 : 2)) / len;
    return { out: series(mag, s.unit, { unit: 'Hz', start: 0, step: 1 / (s.index.step * N) }, `|FFT| of ${s.label}`) };
  },
};

const stats: NodeDef = {
  type: 'stats', title: 'Summary statistics', category: 'processor',
  summary: 'Count, mean, standard deviation, extremes and median of a series, in its own unit.',
  params: [],
  inputs: [{ id: 'in', label: 'Series', type: { kind: 'series', unit: '$U', index: '$I' }, required: true }],
  outputs: [{ id: 'out', label: 'Statistics', type: { kind: 'record' } }],
  run: ({ inputs }) => {
    const s = inputs.in as SeriesValue;
    const v = Array.from(s.values);
    const m = v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
    const sd = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)) : NaN;
    const o = [...v].sort((a, b) => a - b);
    const med = o.length ? (o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2) : NaN;
    const out: RecordValue = {
      kind: 'record',
      rows: [
        { label: 'Count', value: v.length, unit: '1' },
        { label: 'Mean', value: m, unit: s.unit },
        { label: 'Standard deviation', value: sd, unit: s.unit },
        { label: 'Minimum', value: o[0] ?? NaN, unit: s.unit },
        { label: 'Median', value: med, unit: s.unit },
        { label: 'Maximum', value: o[o.length - 1] ?? NaN, unit: s.unit },
      ],
    };
    return { out };
  },
};

/** The unit of the j-th coefficient of y(x): y / x^j, simplified when x is a pure number. */
const coefUnit = (y: Unit, x: Unit, j: number): Unit => (j === 0 || x === '1' ? y : `${y}/${x}${j > 1 ? `^${j}` : ''}`);

const fit: NodeDef = {
  type: 'fit', title: 'Polynomial least squares', category: 'processor', entry: 'least-squares',
  summary: 'The least-squares plate\'s Householder QR: the polynomial of a chosen degree nearest the points.',
  params: [range('degree', 'Degree', 0, 8, 1, 2)],
  inputs: [{ id: 'in', label: 'Points', type: { kind: 'points', x: '$X', y: '$Y' }, required: true }],
  outputs: [
    { id: 'curve', label: 'Fitted curve', type: { kind: 'points', x: '$X', y: '$Y' } },
    { id: 'fit', label: 'Fit', type: { kind: 'record' } },
  ],
  run: ({ params, inputs }) => {
    const p = inputs.in as PointsValue;
    const d = n(params, 'degree');
    const xs = Array.from(p.xs);
    const ys = Array.from(p.ys);
    const distinct = new Set(xs).size;
    if (distinct < d + 1) throw new Error(`a degree-${d} polynomial needs ${d + 1} distinct x values, the points have ${distinct}`);
    const { beta, residual } = lstsq(vandermonde(xs, d), ys);
    const rss = residual.reduce((a, r) => a + r * r, 0);
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const tss = ys.reduce((a, y) => a + (y - my) ** 2, 0);
    const lo = Math.min(...xs); const hi = Math.max(...xs);
    const K = 96;
    const cx = Float64Array.from({ length: K + 1 }, (_, i) => lo + ((hi - lo) * i) / K);
    const curve: PointsValue = { kind: 'points', xs: cx, ys: cx.map((x) => polyval(beta, x)), x: p.x, y: p.y, label: `degree ${d} fit` };
    const out: RecordValue = {
      kind: 'record',
      rows: [
        ...beta.map((b, j) => ({ label: `a${j} (x^${j})`, value: b, unit: coefUnit(p.y, p.x, j) })),
        { label: 'RMS residual', value: Math.sqrt(rss / ys.length), unit: p.y },
        { label: 'R²', value: tss > 0 ? 1 - rss / tss : NaN, unit: '1' },
        { label: 'Points', value: ys.length, unit: '1' },
      ],
    };
    return { curve, fit: out };
  },
};

// ---- sinks: each is shown by a renderer adapter over the value on its input ------------------

const chart: NodeDef = {
  type: 'chart', title: 'Line chart', category: 'sink', view: 'chart',
  summary: 'One or two series on one axis (both in the same units), drawn with the site\'s ECharts layer.',
  params: [{ kind: 'toggle', key: 'logy', label: 'Log y', value: false }],
  inputs: [
    { id: 'a', label: 'Series', type: { kind: 'series', unit: '$U', index: '$I' }, required: true },
    { id: 'b', label: 'Second series', type: { kind: 'series', unit: '$U', index: '$I' } },
  ],
  outputs: [],
  run: () => ({}),
};

const scatter: NodeDef = {
  type: 'scatter', title: 'Interactive scatter', category: 'sink', view: 'scatter',
  summary: 'Points and an optional curve. Dragging a point sends a move intent to the node that owns it.',
  params: [],
  inputs: [
    { id: 'points', label: 'Points', type: { kind: 'points', x: '$X', y: '$Y' }, required: true },
    { id: 'curve', label: 'Curve', type: { kind: 'points', x: '$X', y: '$Y' } },
  ],
  outputs: [],
  run: () => ({}),
};

const readout: NodeDef = {
  type: 'readout', title: 'Readouts', category: 'sink', view: 'readout',
  summary: 'A table of measured values with their units.',
  params: [],
  inputs: [{ id: 'in', label: 'Readouts', type: { kind: 'record' }, required: true }],
  outputs: [],
  run: () => ({}),
};

const exporter: NodeDef = {
  type: 'export', title: 'CSV export', category: 'sink', view: 'export',
  summary: 'Saves a series as a CSV file on this device; nothing is sent anywhere.',
  params: [],
  inputs: [{ id: 'in', label: 'Series', type: { kind: 'series', unit: '$U', index: '$I' }, required: true }],
  outputs: [],
  run: () => ({}),
};

/** A series as CSV: its axis and its values, each column headed with its unit. */
export function seriesCsv(s: SeriesValue): string {
  const lines = [`axis_${s.index.unit},value_${s.unit}`];
  s.values.forEach((v, i) => lines.push(`${s.index.start + i * s.index.step},${v}`));
  return `${lines.join('\n')}\n`;
}

/** Nodes written here; each that runs a catalogue entry names it (`entry`). */
export const DECLARED: AnyNodeDef[] = [keys, signal, csv, points, column, normalize, spectrum, stats, fit, chart, scatter, readout, exporter];

/** One adapter per engine whose kernels the flow can run; every other engine's entries are inferred. */
export const ADAPTERS: Adapter[] = [arrayAdapter, gridAdapter, graphAdapter, treeAdapter, stringAdapter, hashAdapter];

/** Declared nodes and the family nodes derived from the catalogue, in palette order. */
export function library(adapters: readonly Adapter[] = ADAPTERS, entries: readonly Entry[] = ENTRIES, load: KernelLoad = loadKernel): AnyNodeDef[] {
  const derived = deriveNodes(adapters, load, entries);
  return [...DECLARED.slice(0, 6), ...derived, ...DECLARED.slice(6)];
}

export const REGISTRY: Registry = registry(library());
