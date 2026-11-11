// The geometry engine's measurable core. A kernel sees its input and a small set of counted
// primitives (orientation tests, distances, comparisons, and any named count it adds); it
// records frames of marks as it goes, and the plate replays those frames. Nothing here draws:
// the readouts are the counts each frame carries, taken at the moment it was recorded.
import type { Chart, Params, ParamDef, Stat } from '../../core/plate';
import { mulberry32 } from '../../core/random';

export interface Pt { x: number; y: number }
export interface Seg { a: Pt; b: Pt }
export interface Box { x0: number; y0: number; x1: number; y1: number }

/**
 * A drawing instruction in world coordinates (y up). `c` is a position on the palette ramp in
 * [0, 1], or absent for the foreground colour; `a` is alpha 0..255; `w` a stroke width and `r`
 * a dot radius, both in reference pixels the renderer scales with the canvas.
 */
export type Mark =
  | { t: 'p'; x: number; y: number; c?: number; a?: number; r?: number }
  | { t: 'l'; x0: number; y0: number; x1: number; y1: number; c?: number; a?: number; w?: number }
  | { t: 'g'; pts: number[]; close?: boolean; fill?: boolean; c?: number; a?: number; w?: number }
  | { t: 'r'; x0: number; y0: number; x1: number; y1: number; fill?: boolean; c?: number; a?: number; w?: number }
  | { t: 'o'; x: number; y: number; rad: number; fill?: boolean; c?: number; a?: number; w?: number }
  | { t: 'x'; x: number; y: number; s: string; c?: number; a?: number; align?: 'l' | 'c' | 'r' };

export type Counts = Record<string, number>;

export interface Frame { marks: Mark[]; counts: Counts; note: string }

export type InputKind = 'points' | 'segments' | 'orthogonal' | 'polygon' | 'warehouse' | 'firms' | 'none';

export interface Warehouse {
  /** x of each aisle's centre line; picks are walked to along it. */
  aisles: number[];
  /** Aisle length: the front cross aisle is y = 0, the back one y = length. */
  length: number;
  /** Rack width either side of an aisle, drawing only. */
  rack: number;
  depot: Pt;
  picks: { aisle: number; y: number }[];
}

export interface Firm { lat: number; lon: number; weight: number }

export interface Input {
  kind: InputKind;
  shape: string;
  n: number;
  box: Box;
  points: Pt[];
  segments: Seg[];
  polygon: Pt[];
  /** A query rectangle and a query point for range and nearest-neighbour kernels. */
  rect: Box;
  point: Pt;
  warehouse: Warehouse | null;
  firms: Firm[];
  centre: { lat: number; lon: number };
}

/** What a kernel works through: its input and the counted primitives. */
export interface Geo {
  readonly input: Input;
  readonly params: Params;
  /** Seeded randomness for kernels that sample (k-means++ seeding). */
  readonly rnd: () => number;
  /** True when frames are kept (a plate); false in a scaling run. */
  readonly recording: boolean;
  count(key: string, by?: number): void;
  /** (b - a) × (c - a): positive when a, b, c turn counter-clockwise. Counted as `orient`. */
  orient(a: Pt, b: Pt, c: Pt): number;
  /** Squared distance, counted as `dist`. */
  dist2(a: Pt, b: Pt): number;
  /** Distance, counted as `dist`. */
  dist(a: Pt, b: Pt): number;
  /** One comparison x < y, counted as `compare`. */
  less(x: number, y: number): boolean;
  /** Marks drawn under every frame. */
  base(marks: Mark[]): void;
  /** Record a frame; `make` is called at once when the frame is kept, never otherwise. */
  frame(make: () => Mark[], note?: string): void;
  /** Record the closing frame, always kept. */
  last(make: () => Mark[], note?: string): void;
  /** The world box the plate fits to the canvas (defaults to the input's box). */
  view(box: Box): void;
}

export type Task = 'intersections' | 'inclusion' | 'simple-polygon' | 'hull' | 'range' | 'hexbin'
  | 'closest-pair' | 'delaunay' | 'dbscan' | 'kmeans' | 'rings' | 'projections' | 'pick-path';

export interface Outcome {
  /** The kernel's answer, in the shape its task declares; the tests check it. */
  result: unknown;
  /** Final readouts computed from the run. */
  rows?: Stat[];
  /** A chart of values the run measured; replaces the engine's scaling chart. */
  chart?: Chart;
}

export interface GeometryKernel {
  task: Task;
  input: InputKind;
  /** Input shapes offered, by id of input.ts; the first is the default. */
  shapes?: string[];
  n?: { min: number; max: number; value: number; step?: number; label?: string };
  /** Extra controls; each one rebuilds the run. */
  params?: ParamDef[];
  /** [count key, readout label]; the first is the work the scaling chart measures. */
  counters: [string, string][];
  /** Sizes for the measured scaling chart, when the kernel has no chart of its own. */
  scaling?: number[];
  run(g: Geo): Outcome;
}

export interface Trace {
  input: Input;
  base: Mark[];
  frames: Frame[];
  view: Box;
  counts: Counts;
  outcome: Outcome;
}

/** Frames and marks a trace keeps; past either, every other frame is dropped and the stride
 * doubles, so a long run keeps an even sample of itself in bounded memory. */
export const FRAME_CAP = 1200;
export const MARK_CAP = 200_000;

/** Run `kernel` on `input`, counting every primitive and keeping (a sample of) its frames. */
export function record(kernel: GeometryKernel, input: Input, params: Params, seed: number,
  recording = true): Trace {
  const counts: Counts = {};
  for (const [k] of kernel.counters) counts[k] = 0;
  const bump = (k: string, by = 1) => { counts[k] = (counts[k] ?? 0) + by; };
  let frames: Frame[] = [];
  let base: Mark[] = [];
  let view = input.box;
  let stride = 1;
  let seen = 0;
  let kept = 0;
  const g: Geo = {
    input,
    params,
    rnd: mulberry32(seed ^ 0x5bd1e995),
    recording,
    count: bump,
    orient(a, b, c) { bump('orient'); return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); },
    dist2(a, b) { bump('dist'); const dx = a.x - b.x; const dy = a.y - b.y; return dx * dx + dy * dy; },
    dist(a, b) { bump('dist'); return Math.hypot(a.x - b.x, a.y - b.y); },
    less(x, y) { bump('compare'); return x < y; },
    base(m) { if (recording) base = m; },
    view(b) { view = b; },
    frame(make, note = '') {
      if (!recording || seen++ % stride !== 0) return;
      const marks = make();
      frames.push({ marks, counts: { ...counts }, note });
      kept += marks.length;
      while (frames.length > 2 && (frames.length > FRAME_CAP || kept > MARK_CAP)) {
        frames = frames.filter((_, i) => i % 2 === 0);
        kept = frames.reduce((t, f) => t + f.marks.length, 0);
        stride *= 2;
      }
    },
    last(make, note = '') {
      if (recording) frames.push({ marks: make(), counts: { ...counts }, note });
    },
  };
  const outcome = kernel.run(g);
  if (recording) {
    const last = frames[frames.length - 1];
    const same = last && Object.keys(counts).every((k) => last.counts[k] === counts[k]);
    if (!same) frames.push({ marks: last ? last.marks : [], counts: { ...counts }, note: last?.note ?? '' });
  }
  return { input, base, frames, view, counts: { ...counts }, outcome };
}

// Small helpers kernels share for building marks.
export const dots = (pts: Pt[], o: { c?: number; a?: number; r?: number } = {}): Mark[] =>
  pts.map((p) => ({ t: 'p', x: p.x, y: p.y, ...o }));

export const line = (a: Pt, b: Pt, o: { c?: number; a?: number; w?: number } = {}): Mark =>
  ({ t: 'l', x0: a.x, y0: a.y, x1: b.x, y1: b.y, ...o });

export const poly = (pts: Pt[], o: { close?: boolean; fill?: boolean; c?: number; a?: number; w?: number } = {}): Mark =>
  ({ t: 'g', pts: pts.flatMap((p) => [p.x, p.y]), ...o });

export const rect = (b: Box, o: { fill?: boolean; c?: number; a?: number; w?: number } = {}): Mark =>
  ({ t: 'r', x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, ...o });
