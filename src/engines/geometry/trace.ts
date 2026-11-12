// The geometry engine's measurable core. A kernel sees its input and a small set of counted
// primitives (orientation tests, distances, comparisons, and any named count it adds); it
// records frames of marks as it goes, and the plate replays those frames. Nothing here draws:
// the readouts are the counts each frame carries, taken at the moment it was recorded.
import type { Chart, Params, ParamDef, Stat } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import { pack, type Packed } from './track';

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
  /**
   * The algorithm, as a generator: it yields after every bounded piece of work (about O(n)
   * operations), so a run can be drained at once or resumed a few milliseconds per frame.
   */
  run(g: Geo): Generator<unknown, Outcome, unknown>;
}

export interface Trace {
  /** The frame stride the run ended with. */
  stride?: number;
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
/** Marks kept per run: what a frame allocates is garbage later, collected inside some frame. */
export const MARK_CAP = 150_000;

/**
 * One run of a kernel on an input, counting every primitive and keeping (a sample of) its
 * frames. `step()` resumes the kernel to its next yield; the frames, base and view recorded so
 * far are readable while it runs.
 */
export class Recording {
  frames: Frame[] = [];
  /** The frames, packed as recorded, when the recording is `packed` (a plate's own builds:
   * a few flat arrays instead of many small objects keep garbage collection out of frames). */
  packedFrames: { packed: Packed; counts: Counts; note: string }[] = [];
  base: Mark[] = [];
  view: Box;
  done = false;
  private readonly counts: Counts = {};
  private readonly it: Generator<unknown, Outcome, unknown>;
  private outcome: Outcome = { result: null };

  /** The stride frames are kept at: doubled whenever the caps are passed. */
  stride: number;

  /**
   * `stride` starts the sampling coarser: a rebuild of the same settings passes the stride its
   * previous run ended with, so it never makes the frames it would only drop.
   */
  constructor(kernel: GeometryKernel, readonly input: Input, params: Params, seed: number, readonly recording = true,
    readonly packed = false, stride = 1) {
    this.stride = Math.max(1, stride);
    const counts = this.counts;
    for (const [k] of kernel.counters) counts[k] = 0;
    const bump = (k: string, by = 1) => { counts[k] = (counts[k] ?? 0) + by; };
    this.view = input.box;
    let seen = 0;
    let kept = 0;
    let sizes: number[] = [];
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
      base: (m) => { if (recording) this.base = m; },
      view: (b) => { this.view = b; },
      frame: (make, note = '') => {
        if (!recording || seen++ % this.stride !== 0) return;
        const marks = make();
        this.keep(marks, note);
        kept += marks.length;
        sizes.push(marks.length);
        while (this.size > 2 && (this.size > FRAME_CAP || kept > MARK_CAP)) {
          const even = (_: unknown, i: number) => i % 2 === 0;
          if (packed) this.packedFrames = this.packedFrames.filter(even); else this.frames = this.frames.filter(even);
          sizes = sizes.filter(even);
          kept = sizes.reduce((t, v) => t + v, 0);
          this.stride *= 2;
        }
      },
      last: (make, note = '') => {
        if (recording) { const marks = make(); this.keep(marks, note); sizes.push(marks.length); }
      },
    };
    this.it = kernel.run(g);
  }

  private keep(marks: Mark[], note: string): void {
    if (this.packed) this.packedFrames.push({ packed: pack(marks), counts: { ...this.counts }, note });
    else this.frames.push({ marks, counts: { ...this.counts }, note });
  }

  /** Frames kept so far. */
  get size(): number { return this.packed ? this.packedFrames.length : this.frames.length; }

  /** Counts and note of the latest frame. */
  private latest(): { counts: Counts; note: string } | undefined {
    return this.packed ? this.packedFrames[this.packedFrames.length - 1] : this.frames[this.frames.length - 1];
  }

  /** Resume to the next yield; true once the run has finished. */
  step(): boolean {
    if (this.done) return true;
    const r = this.it.next();
    if (!r.done) return false;
    this.outcome = r.value;
    this.done = true;
    if (this.recording) {
      const last = this.latest();
      const same = last && Object.keys(this.counts).every((k) => last.counts[k] === this.counts[k]);
      if (!same) {
        const note = last?.note ?? '';
        if (this.packed) {
          const prev = this.packedFrames[this.packedFrames.length - 1];
          this.packedFrames.push({ packed: prev ? prev.packed : pack([]), counts: { ...this.counts }, note });
        } else this.frames.push({ marks: this.frames[this.frames.length - 1]?.marks ?? [], counts: { ...this.counts }, note });
      }
    }
    return true;
  }

  /** Resume until the run finishes or the clock passes `deadline` (performance.now()). */
  until(deadline: number): boolean {
    while (!this.step()) if (performance.now() >= deadline) return false;
    return true;
  }

  /** The counts so far. */
  get work(): Counts { return { ...this.counts }; }

  /** The outcome, once done. */
  get result(): Outcome { return this.outcome; }

  trace(): Trace {
    return { input: this.input, base: this.base, frames: this.frames, view: this.view, counts: { ...this.counts }, outcome: this.outcome };
  }
}

/** Run `kernel` on `input` to the end at once. */
export function record(kernel: GeometryKernel, input: Input, params: Params, seed: number,
  recording = true, stride = 1): Trace {
  const r = new Recording(kernel, input, params, seed, recording, false, stride);
  while (!r.step());
  return { ...r.trace(), stride: r.stride };
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
