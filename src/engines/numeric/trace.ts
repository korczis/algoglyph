// The numeric engine's measurable core. A kernel computes on seeded input, counts the work it
// does where the count is the point (multiplications, function evaluations, pivots), and returns
// a run: the panels it is drawn in and the steps the plate replays, each step a set of layers in
// data coordinates plus readouts computed from the run itself. Nothing here draws.
import type { DataTable } from '../../core/data';
import type { Chart, ParamDef, Params, Stat } from '../../core/plate';
import { count } from '../../core/format';

export type XY = [number, number];

interface LayerBase {
  /** Index of the panel the layer is drawn in (default 0). */
  panel?: number;
  /** Palette position in [0, 1]; omitted or negative draws in the foreground ink. */
  tone?: number;
  alpha?: number;
}

export type Layer =
  | (LayerBase & { kind: 'curve'; pts: XY[]; n?: number; weight?: number })
  | (LayerBase & { kind: 'points'; pts: XY[]; n?: number; tones?: ArrayLike<number>; size?: number })
  | (LayerBase & { kind: 'segments'; segs: [number, number, number, number][]; weight?: number })
  | (LayerBase & { kind: 'rects'; rects: [number, number, number, number, number][]; outline?: boolean })
  | (LayerBase & { kind: 'polygon'; pts: XY[]; outline?: boolean })
  | (LayerBase & {
    kind: 'grid'; rows: number; cols: number; values: ArrayLike<number>; lo: number; hi: number;
    /** Only the first rowsShown rows are drawn (progressive reveal). */
    rowsShown?: number;
    /** Cells with this value are left clear. */
    clear?: number;
    /** Data box the grid fills [x0, y0, x1, y1]; the panel's box by default. */
    box?: [number, number, number, number];
  })
  | (LayerBase & { kind: 'text'; x: number; y: number; text: string; align?: 'left' | 'center' | 'right' });

export interface Panel {
  title: string;
  x: [number, number];
  y: [number, number];
  /** One data unit is as long on both axes. */
  equal?: boolean;
  /** Draw the zero axes when they fall inside the box. */
  axes?: boolean;
  /** Relative width in the row of panels (default 1). */
  weight?: number;
}

export interface Step {
  layers: Layer[];
  stats: Stat[];
  /** A chart for this step; the run's chart otherwise. */
  chart?: Chart;
}

export interface NumericRun {
  panels: Panel[];
  steps: Step[];
  chart?: Chart;
}

export interface RunInput {
  seed: number;
  params: Params;
  /** A reader's own data by declared id (ADR 0010), when the plate's context carries any. */
  data?: (id: string) => DataTable | null;
}

export interface Probe {
  x: { label: string; log?: boolean };
  y: { label: string; log?: boolean };
  /** Measured series for the lab's shared chart (cheap: it runs when the lab is built). */
  measure(inp: RunInput): { name: string; points: XY[] }[];
}

export interface NumericKernel {
  params?: ParamDef[];
  aspect?: number;
  /** Fraction of the run the gallery thumbnail shows (default: the last step). */
  thumb?: number;
  palette?: string;
  run(inp: RunInput): NumericRun;
  /**
   * The same run built in slices: a generator that yields between pieces of work of a few
   * milliseconds each, so the engine can spread a rebuild over frames instead of freezing one.
   * A kernel whose run is heavy provides it and defines `run` as `drain(build(inp))`.
   */
  build?(inp: RunInput): Generator<void, NumericRun, void>;
  probe?: Probe;
}

/** A resumable computation run to its end in one go. */
export function drain<T>(g: Generator<void, T, void>): T {
  for (;;) {
    const s = g.next();
    if (s.done) return s.value;
  }
}

/** Resume a computation for up to `ms` milliseconds; its value when it finished, else undefined. */
export function resume<T>(g: Generator<void, T, void>, ms: number): T | undefined {
  const t0 = performance.now();
  for (;;) {
    const s = g.next();
    if (s.done) return s.value;
    if (performance.now() - t0 >= ms) return undefined;
  }
}

/** xs.map(f) as a resumable computation, yielding after every `every` items. */
export function* mapSliced<T, U>(xs: readonly T[], f: (x: T, i: number) => U, every = 8): Generator<void, U[], void> {
  const out: U[] = [];
  for (let i = 0; i < xs.length; i++) {
    out.push(f(xs[i], i));
    if ((i + 1) % every === 0) yield;
  }
  return out;
}

/** A kernel's run as a resumable computation: its own slices, or the whole run as one. */
export function building(k: NumericKernel, inp: RunInput): Generator<void, NumericRun, void> {
  return k.build ? k.build(inp) : (function* () { return k.run(inp); })();
}

/** Counts the operations a kernel performs, by name. */
export class Meter {
  readonly c: Record<string, number> = {};
  tick(name: string, k = 1): void { this.c[name] = (this.c[name] ?? 0) + k; }
  get(name: string): number { return this.c[name] ?? 0; }
  mul(a: number, b: number): number { this.tick('mul'); return a * b; }
  add(a: number, b: number): number { this.tick('add'); return a + b; }
  sub(a: number, b: number): number { this.tick('add'); return a - b; }
  /** Wrap f so that every evaluation is counted under `evals`. */
  counted(f: (x: number) => number): (x: number) => number {
    return (x) => { this.tick('evals'); return f(x); };
  }
}

/** Least-squares line through points: [slope, intercept]. */
export function fitLine(pts: XY[]): [number, number] {
  const q = pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (q.length < 2) return [NaN, NaN];
  const mx = q.reduce((s, p) => s + p[0], 0) / q.length;
  const my = q.reduce((s, p) => s + p[1], 0) / q.length;
  let sxy = 0; let sxx = 0;
  for (const [x, y] of q) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  const b = sxx ? sxy / sxx : NaN;
  return [b, my - b * mx];
}

/** Slope of log y against log x over the positive points: a measured growth exponent. */
export function logSlope(pts: XY[]): number {
  return fitLine(pts.filter(([x, y]) => x > 0 && y > 0).map(([x, y]) => [Math.log(x), Math.log(y)]))[0];
}

/** A number for a readout: fixed for ordinary magnitudes, exponential for tiny or huge ones. */
export function fmt(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 1e-3 || a >= 1e7) return v.toExponential(2);
  if (Number.isInteger(v)) return count(v);
  return Number(v.toPrecision(digits)).toLocaleString('en-US', { maximumFractionDigits: 8 });
}

export const int = (v: number) => count(v);

/** The bounding range of values with a margin, for a panel axis. */
export function span(values: Iterable<number>, margin = 0.06): [number, number] {
  let lo = Infinity; let hi = -Infinity;
  for (const v of values) if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!Number.isFinite(lo)) return [0, 1];
  if (hi - lo < 1e-12) { lo -= 0.5; hi += 0.5; }
  const m = (hi - lo) * margin;
  return [lo - m, hi + m];
}

/** Sample f on [a, b] at n + 1 points. */
export function sample(f: (x: number) => number, a: number, b: number, n = 240): XY[] {
  return Array.from({ length: n + 1 }, (_, i) => { const x = a + ((b - a) * i) / n; return [x, f(x)]; });
}

/** Evenly spaced indices into a run of n items, at most k of them, ending at n. */
export function checkpoints(n: number, k: number): number[] {
  if (n <= k) return Array.from({ length: n }, (_, i) => i + 1);
  return Array.from({ length: k }, (_, i) => Math.max(1, Math.round(((i + 1) * n) / k)));
}
