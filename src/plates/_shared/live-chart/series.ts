// Live charts of the bespoke sorting plates: bounded point series that grow while a plate runs,
// the running mean of measured runs next to the value theory expects for the same runs, and a
// least-squares power fit on a log-log scale. The Chart itself is the core's declarative one
// (src/core/charts.ts renders it with ECharts); this module only keeps the points honest and few.
import type { Chart } from '../../../core/plate';

/** A series of at most `max` points: past it, every other interior point is dropped. */
export class Series {
  points: [number, number][] = [];

  constructor(readonly name: string, readonly max = 240) {}

  push(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.points.push([x, y]);
    if (this.points.length > this.max) {
      const last = this.points[this.points.length - 1];
      this.points = this.points.filter((_, i) => i % 2 === 0);
      if (this.points[this.points.length - 1] !== last) this.points.push(last);
    }
  }

  clear(): void {
    this.points = [];
  }

  get length(): number {
    return this.points.length;
  }
}

/**
 * Finished runs of a randomised plate: what each one measured and what theory expected for that
 * very run (its input), so that the running means can be set side by side as the runs add up.
 */
export class Trials {
  count = 0;
  private sum = 0;
  private sumSq = 0;
  private expectedSum = 0;
  readonly measured: Series;
  readonly theory: Series;

  constructor(measuredName: string, theoryName: string) {
    this.measured = new Series(measuredName);
    this.theory = new Series(theoryName);
  }

  add(measured: number, expected: number): void {
    this.count++;
    this.sum += measured;
    this.sumSq += measured * measured;
    this.expectedSum += expected;
    this.measured.push(this.count, this.mean);
    this.theory.push(this.count, this.expected);
  }

  get mean(): number {
    return this.count ? this.sum / this.count : NaN;
  }

  /** The mean that theory predicts for the runs so far. */
  get expected(): number {
    return this.count ? this.expectedSum / this.count : NaN;
  }

  /** Standard error of the measured mean (NaN below two runs). */
  get stderr(): number {
    if (this.count < 2) return NaN;
    const v = (this.sumSq - (this.sum * this.sum) / this.count) / (this.count - 1);
    return Math.sqrt(Math.max(0, v) / this.count);
  }
}

/** Least-squares line through (log x, log y): y ≈ c·x^k. Needs two points with x, y > 0. */
export function powerFit(points: readonly [number, number][]): { k: number; c: number } {
  const pts = points.filter(([x, y]) => x > 0 && y > 0).map(([x, y]) => [Math.log(x), Math.log(y)]);
  if (pts.length < 2) return { k: NaN, c: NaN };
  const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
  const my = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  let sxy = 0;
  let sxx = 0;
  for (const [x, y] of pts) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
  }
  if (!sxx) return { k: NaN, c: NaN };
  const k = sxy / sxx;
  return { k, c: Math.exp(my - k * mx) };
}

/** A chart of the given series (empty series are left out, so a legend never lists nothing). */
export function chartOf(title: string, x: Chart['x'], y: Chart['y'], series: readonly Series[]): Chart {
  return {
    title, x, y,
    series: series.filter((s) => s.length > 0).map((s) => ({ name: s.name, points: s.points.slice() })),
  };
}

const EN = 'en-US';

/** A count for a readout: grouped digits, exponent form from 1e9. */
export function fmt(x: number, digits = 0): string {
  if (!Number.isFinite(x)) return '–';
  if (Math.abs(x) >= 1e9) return x.toExponential(3);
  return x.toLocaleString(EN, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
