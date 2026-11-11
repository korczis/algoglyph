// A replayable run, from a trace in memory or from its compact encoding. The encoding packs every
// frame's marks into one Float64Array (transferable, so a worker hands it over without a copy),
// and the plate decodes only the frame it draws.
import type { Chart, Stat } from '../../core/plate';
import type { Box, Counts, Mark, Trace } from './trace';

export interface Track {
  readonly length: number;
  readonly base: Mark[];
  readonly view: Box;
  readonly final: Counts;
  readonly rows: Stat[];
  readonly chart: Chart | undefined;
  marks(i: number): Mark[];
  counts(i: number): Counts;
  note(i: number): string;
}

export function fromTrace(t: Trace): Track {
  return {
    length: t.frames.length,
    base: t.base,
    view: t.view,
    final: t.counts,
    rows: t.outcome.rows ?? [],
    chart: t.outcome.chart,
    marks: (i) => t.frames[i]?.marks ?? [],
    counts: (i) => t.frames[i]?.counts ?? t.counts,
    note: (i) => t.frames[i]?.note ?? '',
  };
}

export interface Encoded {
  keys: string[];
  data: Float64Array;
  /** Start of each frame's marks in `data`; one more entry than frames. */
  starts: Int32Array;
  /** keys.length counts per frame. */
  counts: Float64Array;
  notes: string[];
  strings: string[];
  base: Mark[];
  view: Box;
  final: Counts;
  rows: Stat[];
  chart: Chart | undefined;
}

const KIND = { p: 0, l: 1, g: 2, r: 3, o: 4, x: 5 } as const;
const ALIGN = { l: 1, c: 2, r: 3 } as const;
const opt = (v: number | undefined) => (v === undefined ? NaN : v);
const back = (v: number) => (Number.isNaN(v) ? undefined : v);

export function encode(t: Trace): { enc: Encoded; transfer: ArrayBuffer[] } {
  const keys = Object.keys(t.counts);
  let size = 0;
  for (const f of t.frames) for (const m of f.marks) size += 5 + (m.t === 'g' ? 1 + m.pts.length : 4);
  const data = new Float64Array(size);
  const starts = new Int32Array(t.frames.length + 1);
  const counts = new Float64Array(t.frames.length * keys.length);
  const strings: string[] = [];
  let k = 0;
  t.frames.forEach((f, fi) => {
    starts[fi] = k;
    keys.forEach((key, j) => { counts[fi * keys.length + j] = f.counts[key] ?? 0; });
    for (const m of f.marks) {
      data[k++] = KIND[m.t];
      data[k++] = opt(m.c);
      data[k++] = opt(m.a);
      data[k++] = m.t === 'p' ? opt(m.r) : m.t === 'x' ? NaN : opt(m.w);
      data[k++] = ('fill' in m && m.fill ? 1 : 0) + ('close' in m && m.close ? 2 : 0) + (m.t === 'x' ? 4 * (m.align ? ALIGN[m.align] : 0) : 0);
      switch (m.t) {
        case 'p': data[k++] = m.x; data[k++] = m.y; data[k++] = 0; data[k++] = 0; break;
        case 'l': case 'r': data[k++] = m.x0; data[k++] = m.y0; data[k++] = m.x1; data[k++] = m.y1; break;
        case 'o': data[k++] = m.x; data[k++] = m.y; data[k++] = m.rad; data[k++] = 0; break;
        case 'x': data[k++] = m.x; data[k++] = m.y; data[k++] = strings.push(m.s) - 1; data[k++] = 0; break;
        case 'g': data[k++] = m.pts.length; data.set(m.pts, k); k += m.pts.length; break;
      }
    }
  });
  starts[t.frames.length] = k;
  return {
    enc: {
      keys, data, starts, counts, notes: t.frames.map((f) => f.note), strings,
      base: t.base, view: t.view, final: t.counts, rows: t.outcome.rows ?? [], chart: t.outcome.chart,
    },
    transfer: [data.buffer as ArrayBuffer, starts.buffer as ArrayBuffer, counts.buffer as ArrayBuffer],
  };
}

export function decode(e: Encoded, fi: number): Mark[] {
  const out: Mark[] = [];
  const d = e.data;
  let k = e.starts[fi];
  const end = e.starts[fi + 1];
  while (k < end) {
    const kind = d[k]; const c = back(d[k + 1]); const a = back(d[k + 2]); const w = back(d[k + 3]); const flags = d[k + 4];
    k += 5;
    const fill = (flags & 1) === 1; const close = (flags & 2) === 2;
    if (kind === KIND.g) {
      const len = d[k++];
      out.push({ t: 'g', pts: Array.from(d.subarray(k, k + len)), fill, close, c, a, w });
      k += len;
      continue;
    }
    const [x0, y0, x1, y1] = [d[k], d[k + 1], d[k + 2], d[k + 3]];
    k += 4;
    if (kind === KIND.p) out.push({ t: 'p', x: x0, y: y0, c, a, r: w });
    else if (kind === KIND.l) out.push({ t: 'l', x0, y0, x1, y1, c, a, w });
    else if (kind === KIND.r) out.push({ t: 'r', x0, y0, x1, y1, fill, c, a, w });
    else if (kind === KIND.o) out.push({ t: 'o', x: x0, y: y0, rad: x1, fill, c, a, w });
    else {
      const al = (flags >> 2) & 3;
      out.push({ t: 'x', x: x0, y: y0, s: e.strings[x1], c, a, align: al === 1 ? 'l' : al === 2 ? 'c' : al === 3 ? 'r' : undefined });
    }
  }
  return out;
}

export function fromEncoded(e: Encoded): Track {
  const frames = e.starts.length - 1;
  let cached = -1;
  let cache: Mark[] = [];
  return {
    length: frames,
    base: e.base,
    view: e.view,
    final: e.final,
    rows: e.rows,
    chart: e.chart,
    marks(i) {
      if (i < 0 || i >= frames) return [];
      if (i !== cached) { cache = decode(e, i); cached = i; }
      return cache;
    },
    counts(i) {
      if (i < 0 || i >= frames) return e.final;
      const out: Counts = {};
      e.keys.forEach((key, j) => { out[key] = e.counts[i * e.keys.length + j]; });
      return out;
    },
    note: (i) => e.notes[i] ?? '',
  };
}
