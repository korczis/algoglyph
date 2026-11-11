// The signal engine's contract. A kernel turns a seeded synthetic signal into a recorded trace
// of views, each view a few declarative panels (waveforms, spectra, a waterfall, the z-plane,
// phase portraits) with the readouts measured at that point of the run. Every multiply,
// butterfly or frame a kernel performs goes through a Meter, so the counts the plate shows are
// the counts of the run itself. Nothing here draws.
import type { Chart, ParamDef, Params, Stat } from '../../core/plate';

/** Counts what a kernel performs; each view carries a snapshot taken when it was recorded. */
export class Meter {
  private c = new Map<string, number>();
  add(name: string, k = 1): void { this.c.set(name, (this.c.get(name) ?? 0) + k); }
  get(name: string): number { return this.c.get(name) ?? 0; }
  snapshot(): Record<string, number> { return Object.fromEntries(this.c); }
}

/** Counter names shared by the kernels and the lab. */
export const MUL = 'Real multiplies';
export const BUTTERFLY = 'Butterflies';
export const FRAME = 'Frames';

/** One curve: values at evenly spaced positions; `tone` picks a palette position, -1 the ink. */
export interface Series {
  name: string;
  y: ArrayLike<number>;
  tone?: number;
  /** Draw as stems rather than a line. */
  stems?: boolean;
  /** Line alpha, 0..255. */
  alpha?: number;
}

export interface Mark { at: number; label?: string }

/** Time-domain curves over sample index; `upto` reveals only a prefix (a cursor). */
export interface WavePanel {
  kind: 'wave';
  title: string;
  series: Series[];
  range?: [number, number];
  upto?: number;
  marks?: Mark[];
}

/** Curves stacked in their own strips, each scaled to its own range. */
export interface LanesPanel {
  kind: 'lanes';
  title: string;
  lanes: Series[];
  upto?: number;
  marks?: Mark[];
}

/** Magnitude in dB over frequency: y[k] lies at fmax * k / (length - 1). */
export interface SpectrumPanel {
  kind: 'spectrum';
  title: string;
  fmax: number;
  /** With `logx`, the lowest frequency drawn. */
  fmin?: number;
  logx?: boolean;
  floor: number;
  ceil: number;
  series: Series[];
  marks?: Mark[];
}

/** Rows of dB spectra over time, oldest at the left; `upto` rows are shown. */
export interface WaterfallPanel {
  kind: 'waterfall';
  title: string;
  rows: Float32Array[];
  upto: number;
  fmax: number;
  floor: number;
  ceil: number;
}

/** The z-plane: the unit circle, poles (x) and zeros (o). */
export interface PlanePanel {
  kind: 'plane';
  title: string;
  poles: [number, number][];
  zeros: [number, number][];
}

/** Free 2D drawing in data coordinates: polylines, dots, arrows and labels. */
export interface XYPanel {
  kind: 'xy';
  title: string;
  /** [x0, x1, y0, y1] */
  range: [number, number, number, number];
  equal?: boolean;
  lines?: { pts: ArrayLike<number>; tone?: number; weight?: number; alpha?: number }[];
  dots?: { x: number; y: number; tone?: number; r?: number }[];
  arrows?: { x0: number; y0: number; x1: number; y1: number; tone?: number }[];
  labels?: { x: number; y: number; text: string }[];
  /** Axis captions, drawn under and beside the plot. */
  xLabel?: string;
  yLabel?: string;
}

/** The radix-2 butterfly network; `mags[s]` are |x| after `s` stages (0 = bit-reversed input). */
export interface ButterflyPanel {
  kind: 'butterfly';
  title: string;
  n: number;
  done: number;
  mags: Float64Array[];
}

/** Monospaced lines (bits, hex frames, fields). */
export interface TextPanel {
  kind: 'text';
  title: string;
  lines: { text: string; tone?: number }[];
}

export type Panel = WavePanel | LanesPanel | SpectrumPanel | WaterfallPanel | PlanePanel | XYPanel
  | ButterflyPanel | TextPanel;

/** One recorded moment of a run. */
export interface View {
  panels: Panel[];
  /** Readouts measured at this moment (the engine adds the counts). */
  stats: Stat[];
  counts: Record<string, number>;
  chart?: Chart;
  /** Rows of panel indices; the default packs one to four panels. */
  layout?: number[][];
}

export interface SignalKernel {
  /** Parameters of this kernel; the engine re-runs it when any of them changes. */
  params?: ParamDef[];
  aspect?: number;
  /** Default replay speed, in recorded views per second. */
  rate?: number;
  /** Record a run on a signal seeded by `seed`. */
  run(params: Params, seed: number, meter: Meter): View[];
  /** The kernel applied to the lab's shared input: its result as one panel, its work metered. */
  lab?(x: Float64Array, fs: number, meter: Meter): Panel;
}

export const db = (power: number, floor = -200): number =>
  power > 0 ? Math.max(floor, 10 * Math.log10(power)) : floor;

/** Downsample a curve to at most `max` points [x, y] for a chart (keeps every max/min pair). */
export function chartPoints(y: ArrayLike<number>, x: (i: number) => number, max = 400,
  from = 0, to = y.length): [number, number][] {
  const out: [number, number][] = [];
  const n = to - from;
  if (n <= max) {
    for (let i = from; i < to; i++) out.push([x(i), y[i]]);
    return out;
  }
  const per = Math.ceil(n / (max / 2));
  for (let s = from; s < to; s += per) {
    let lo = s; let hi = s;
    for (let i = s; i < Math.min(to, s + per); i++) {
      if (y[i] < y[lo]) lo = i;
      if (y[i] > y[hi]) hi = i;
    }
    const [a, b] = lo < hi ? [lo, hi] : [hi, lo];
    out.push([x(a), y[a]]);
    if (b !== a) out.push([x(b), y[b]]);
  }
  return out;
}

export const fmtInt = (x: number): string => Math.round(x).toLocaleString('en-US');
export const fmtHz = (f: number): string => (Math.abs(f) >= 1000 ? `${(f / 1000).toFixed(3)} kHz`
  : `${f.toFixed(2)} Hz`);
