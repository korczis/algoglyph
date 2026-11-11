// The stochastic engine's measurable core: a kernel draws randomness and evaluates its model
// only through these operations, every draw and evaluation is counted, and the run is
// recorded as frames the plate replays. Nothing here draws on a canvas; a frame is a
// declarative picture (histograms, plots, bars) plus readouts measured at that point.
import { mulberry32 } from '../../core/random';
import type { ParamDef, Params, Stat } from '../../core/plate';

/** Tone of a mark: a position on the palette ramp in [0, 1], or FG for the foreground. */
export const FG = -1;

export interface Mark {
  /** A vertical line at x, or a horizontal line at y. */
  x?: number;
  y?: number;
  label?: string;
  tone?: number;
  dash?: boolean;
}

export interface Hist {
  kind: 'hist';
  title: string;
  lo: number;
  hi: number;
  /** Counts per equal-width bin on [lo, hi]. */
  bins: number[];
  tone?: number;
  /** A second histogram on the same bins, drawn as an outline. */
  overlay?: { bins: number[]; tone: number };
  /** Draw proportions rather than counts (to compare samples of different sizes). */
  normalise?: boolean;
  /** A reference density, scaled by the engine to the histogram's total and bin width. */
  density?: [number, number][];
  marks?: Mark[];
  /** A shaded x-range (a tail, an interval). */
  shade?: [number, number];
}

export interface Line { pts: [number, number][]; tone?: number; weight?: number; alpha?: number; dash?: boolean }
export interface Dots { pts: [number, number][]; tone?: number; tones?: number[]; size?: number; alpha?: number }

export interface Plot {
  kind: 'plot';
  title: string;
  x: [number, number];
  y: [number, number];
  /** A background field, values in [0, 1], values[j * w + i] with j counted from the bottom. */
  field?: { w: number; h: number; values: ArrayLike<number> };
  /** A shaded band, [x, low, high] per point. */
  band?: { pts: [number, number, number][]; tone?: number };
  lines?: Line[];
  dots?: Dots[];
  marks?: Mark[];
}

export interface BarRow {
  label: string;
  lo: number;
  hi: number;
  tone?: number;
  /** A reference tick (the exact value, the truth). */
  mark?: number;
  /** A whisker [low, high] (a standard-error range). */
  err?: [number, number];
}

export interface Bars {
  kind: 'bars';
  title: string;
  x: [number, number];
  rows: BarRow[];
}

export type Panel = Hist | Plot | Bars;

export interface Frame {
  panels: Panel[];
  stats: Stat[];
  /** Draws and evaluations counted up to this frame. */
  draws: number;
  evals: number;
  /** Chart series as they stood at this frame: name, points, length to show. */
  series: [string, [number, number][], number][];
}

export interface StochasticOps {
  /** One counted uniform draw in [0, 1). */
  rnd(): number;
  /** One counted evaluation of the kernel's model or objective. */
  evaluate<A extends unknown[], T>(f: (...a: A) => T, ...a: A): T;
  /** Count k evaluations done in bulk (a pair comparison sweep, a likelihood grid). */
  count(k: number): void;
  /** Append a point to a chart series. */
  point(series: string, x: number, y: number): void;
  /** Replace a chart series. */
  setSeries(series: string, pts: [number, number][]): void;
  /** Record a frame: what to draw and the readouts measured now. */
  frame(panels: Panel[], stats: Stat[]): void;
  readonly draws: number;
  readonly evals: number;
}

export interface StochasticKernel<R = unknown> {
  /** Kernel controls; each one rebuilds the run. */
  params?: ParamDef[];
  palette?: string;
  chart: { title: string; x: { label: string; log?: boolean }; y: { label: string; log?: boolean } };
  /** The chart series a lab compares across kernels. */
  labSeries?: string;
  run(ops: StochasticOps, cfg: Params): R;
}

export interface Run<R = unknown> {
  frames: Frame[];
  result: R;
  draws: number;
  evals: number;
}

/** A guard against a kernel that records without bound. */
export const FRAME_CAP = 2000;

/** The kernel's own defaults, overridden by the given parameters. */
export function config(kernel: StochasticKernel, params: Params = {}): Params {
  const out: Params = {};
  for (const d of kernel.params ?? []) out[d.key] = d.value;
  for (const [k, v] of Object.entries(params)) out[k] = v;
  return out;
}

/** Run `kernel` with a generator seeded from `seed`, counting and recording everything. */
export function trace<R>(kernel: StochasticKernel<R>, params: Params, seed: number): Run<R> {
  const u = mulberry32(seed);
  let draws = 0;
  let evals = 0;
  const frames: Frame[] = [];
  const series = new Map<string, [number, number][]>();
  const ops: StochasticOps = {
    rnd() { draws++; return u(); },
    evaluate(f, ...a) { evals++; return f(...a); },
    count(k) { evals += k; },
    point(name, x, y) {
      let s = series.get(name);
      if (!s) { s = []; series.set(name, s); }
      s.push([x, y]);
    },
    setSeries(name, pts) { series.set(name, pts.map((q) => [q[0], q[1]] as [number, number])); },
    frame(panels, stats) {
      if (frames.length >= FRAME_CAP) throw new Error(`a kernel recorded more than ${FRAME_CAP} frames`);
      frames.push({ panels, stats, draws, evals, series: [...series].map(([n, s]) => [n, s, s.length]) });
    },
    get draws() { return draws; },
    get evals() { return evals; },
  };
  const result = kernel.run(ops, config(kernel as StochasticKernel, params));
  if (!frames.length) ops.frame([], []);
  return { frames, result, draws, evals };
}

/** Counts per equal-width bin of [lo, hi]; values outside fall into the end bins. */
export function histogram(xs: ArrayLike<number>, lo: number, hi: number, k: number, from = 0,
  to = xs.length): number[] {
  const bins = new Array<number>(k).fill(0);
  const w = (hi - lo) / k;
  for (let i = from; i < to; i++) {
    const b = Math.floor((xs[i] - lo) / w);
    bins[Math.max(0, Math.min(k - 1, b))]++;
  }
  return bins;
}
