// A detector of finite resolution reading a fringe pattern (FLP III/1, the figure of very fine
// fringes for heavy bullets). A real detector reports a position blurred by a normalised,
// non-negative response K: p_meas = K ∗ p_true. For a fringe of period Λ the blur multiplies the
// fringe's contrast by the kernel's Fourier transform at 2π/Λ:
//   Gaussian of standard deviation σ:  exp(−2π²σ²/Λ²)
//   box of width w:                    sinc(πw/Λ), which goes negative for 1 < w/Λ < 2 (and in
//                                      every other odd band): the fringes come back reversed.
// The pattern itself is not changed: the particles still arrive in fringes; only the reading is
// smoothed. That is coarse-graining by the instrument, not decoherence.
//
// The check is numerical on purpose: the pattern 1 + cos(2πx/Λ) is laid on a grid that resolves
// Λ (CELLS_PER_PERIOD cells per period), over a whole number of periods, and convolved with the
// sampled kernel cyclically; the contrast is then measured from the convolved grid. The closed
// forms above are what it is compared with, never what produces it. The envelope of the
// single-slit pattern is taken as flat across the detector's reach: that is where the attenuation
// law holds, and the plate says so.
import { sinc } from './math';

export type KernelKind = 'gaussian' | 'box';

export const CELLS_PER_PERIOD = 64;
/** A Gaussian kernel is cut at ±TRUNCATE standard deviations (tail mass 5.7·10⁻⁷). */
export const TRUNCATE = 5;
/** The widest kernel, in fringe periods, that the grid run takes. */
export const MAX_GRID_WIDTH = { gaussian: 4, box: 64 } as const;

/** The contrast factor in closed form; signed. `width` is σ (Gaussian) or w (box), over Λ. */
export function attenuation(kind: KernelKind, width: number): number {
  return kind === 'gaussian'
    ? Math.exp(-2 * Math.PI * Math.PI * width * width)
    : sinc(Math.PI * width);
}

/**
 * The kernel sampled on cells of size h (in periods: h = 1/CELLS_PER_PERIOD), centred, each weight
 * non-negative and the weights summing to 1. A Gaussian is sampled at the cell centres; a box gives
 * each cell the fraction of it the box covers, so its area is exact.
 *
 * The grid's error for a box, against sinc(πw/Λ): a fully covered cell carries the box's area over
 * the cell, but the fringe is read at the cell's centre, whose cosine is the cell average of the
 * cosine divided by sinc(πh/Λ). So full cells give the factor ÷ sinc(π/64), a relative 4.0e−4
 * ((π/64)²/6); the two partly covered end cells add an error of the same order and either sign.
 * At w/Λ = 1.37 that is about 9e−5 from the cells and 1.4e−4 in all; across widths it stays under
 * 1e−3 (test/two-slit.test.ts). The claim on the box allows 3e−4.
 */
export function sampledKernel(kind: KernelKind, width: number, h: number): Float64Array {
  if (kind === 'gaussian') {
    const r = Math.max(1, Math.ceil((TRUNCATE * width) / h));
    const k = new Float64Array(2 * r + 1);
    let sum = 0;
    for (let i = -r; i <= r; i++) {
      const x = i * h;
      const v = width > 0 ? Math.exp(-(x * x) / (2 * width * width)) : (i === 0 ? 1 : 0);
      k[i + r] = v;
      sum += v;
    }
    for (let i = 0; i < k.length; i++) k[i] /= sum;
    return k;
  }
  const half = width / 2;
  const r = Math.max(0, Math.ceil(half / h + 0.5));
  const k = new Float64Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const lo = Math.max(-half, (i - 0.5) * h);
    const hi = Math.min(half, (i + 0.5) * h);
    const v = width > 0 ? Math.max(0, hi - lo) : (i === 0 ? 1 : 0);
    k[i + r] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}

export interface GridReading {
  /** Whole fringe periods on the grid. */
  periods: number;
  cells: number;
  /** The pattern as it arrives, and as the detector reads it, per cell. */
  truth: Float64Array;
  measured: Float64Array;
  /** Σ kernel − 1 and Σ measured − Σ truth: numerics, both zero to rounding. */
  kernelSumError: number;
  normError: number;
  /** The contrast of each pattern, measured from the grid (signed). */
  vTrue: number;
  vMeasured: number;
}

/** The signed contrast of a periodic grid over whole periods: 2·Σ p cos(2πx/Λ) / Σ p. */
export function gridContrast(p: Float64Array, cellsPerPeriod = CELLS_PER_PERIOD): number {
  let c = 0;
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    c += p[i] * Math.cos((2 * Math.PI * i) / cellsPerPeriod);
    s += p[i];
  }
  return (2 * c) / s;
}

/**
 * The grid run for a kernel of the given width in fringe periods, or null when it is wider than
 * the grid takes (MAX_GRID_WIDTH): the number of cells grows with the width.
 */
export function gridReading(kind: KernelKind, width: number): GridReading | null {
  if (!(width >= 0) || width > MAX_GRID_WIDTH[kind]) return null;
  const h = 1 / CELLS_PER_PERIOD;
  const k = sampledKernel(kind, width, h);
  const r = (k.length - 1) / 2;
  // whole periods, wider than the kernel so the cyclic sum never folds the kernel onto itself
  const periods = Math.max(4, Math.ceil((k.length + 1) / CELLS_PER_PERIOD) + 1);
  const cells = periods * CELLS_PER_PERIOD;
  const truth = new Float64Array(cells);
  for (let i = 0; i < cells; i++) truth[i] = 1 + Math.cos((2 * Math.PI * i) / CELLS_PER_PERIOD);
  const measured = new Float64Array(cells);
  for (let i = 0; i < cells; i++) {
    let acc = 0;
    // the period is a power of two cells, so (i − j) & (CELLS_PER_PERIOD − 1) is the cyclic index
    for (let j = -r; j <= r; j++) acc += k[j + r] * truth[(i - j) & (CELLS_PER_PERIOD - 1)];
    measured[i] = acc;
  }
  let ksum = 0;
  for (const v of k) ksum += v;
  let st = 0;
  let sm = 0;
  for (let i = 0; i < cells; i++) {
    st += truth[i];
    sm += measured[i];
  }
  return {
    periods, cells, truth, measured,
    kernelSumError: ksum - 1,
    normError: sm - st,
    vTrue: gridContrast(truth),
    vMeasured: gridContrast(measured),
  };
}
