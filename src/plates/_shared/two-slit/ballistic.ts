// Bullets through two holes (FLP III/1, the experiment with bullets), as a seeded Monte Carlo of
// an idealised apparatus. A gun at the origin fires in a direction uniform within ±spread; a wall
// at distance L1 has two holes of width a at ±d/2; a bullet that reaches a hole leaves it with its
// direction changed by a ricochet angle, normal with standard deviation σᵣ (a model of glancing off
// the hole's edge, chosen here, not a law of bullets); a backstop at L2 beyond the wall records
// where it lands, inside its half-height Y, in bins. A bullet goes through one hole or the other
// and never both: nothing that passes one hole is affected by whether the other is open.
//
// Three runs of N emitted bullets each, with hole 2 closed, hole 1 closed, and both open, give the
// histograms n₁, n₂ and n₁₂. With nothing coupling the holes, n₁₂ and n₁ + n₂ estimate the same
// curve, so χ² = Σ (n₁₂ − n₁ − n₂)² / (n₁₂ + n₁ + n₂) over k bins follows χ²ₖ: the variance of a
// difference of independent Poisson counts is the sum of the counts. Bins whose expected count
// (n₁ + n₂) is under MIN_EXPECTED are merged from each tail inward, so every bin judged has at
// least that many.
// Pure: no p5, randomness only from the generator passed in.
import { gaussian } from '../../../core/random';
import { chiSquareBand } from './math';

export interface Gun {
  /** Half-angle of the gun's spread (rad). */
  spread: number;
  /** Hole width and centre-to-centre separation (m). */
  a: number;
  d: number;
  /** Ricochet standard deviation (rad). */
  ricochet: number;
  /** Gun to wall, wall to backstop (m). */
  L1: number;
  L2: number;
  /** Backstop half-height (m) and its bins. */
  Y: number;
  bins: number;
}

export type Openings = 'one' | 'two' | 'both';

export interface Tally {
  emitted: number;
  /** Stopped by the wall (outside the open holes). */
  blocked: number;
  /** Landed on the backstop. */
  detected: number;
  /** Passed a hole and landed beyond the backstop's edge. */
  missed: number;
  hist: Float64Array;
  /** The last bullet: where it met the wall (m), where it ended (m, NaN when stopped there), and
   * whether it landed on the backstop. For drawing its track. */
  last: { yw: number; y: number; detected: boolean };
}

export const MIN_EXPECTED = 5;

export function tally(g: Gun): Tally {
  return {
    emitted: 0, blocked: 0, detected: 0, missed: 0, hist: new Float64Array(g.bins),
    last: { yw: 0, y: NaN, detected: false },
  };
}

/** Fire one bullet with the given holes open and record where it went. */
export function fire(g: Gun, open: Openings, rnd: () => number, t: Tally): void {
  t.emitted++;
  const alpha = (2 * rnd() - 1) * g.spread;
  const yw = g.L1 * Math.tan(alpha);
  const in1 = Math.abs(yw - g.d / 2) <= g.a / 2;
  const in2 = Math.abs(yw + g.d / 2) <= g.a / 2;
  const passes = (in1 && open !== 'two') || (in2 && open !== 'one');
  t.last = { yw, y: NaN, detected: false };
  if (!passes) {
    t.blocked++;
    return;
  }
  const out = alpha + g.ricochet * gaussian(rnd);
  if (Math.abs(out) >= Math.PI / 2) {
    t.missed++;
    return;
  }
  const y = yw + g.L2 * Math.tan(out);
  t.last.y = y;
  if (Math.abs(y) >= g.Y) {
    t.missed++;
    return;
  }
  t.detected++;
  t.last.detected = true;
  t.hist[Math.min(g.bins - 1, Math.floor(((y + g.Y) / (2 * g.Y)) * g.bins))]++;
}

/** Bin groups [from, to) whose expected count n₁ + n₂ is at least MIN_EXPECTED, tails merged. */
export function mergedBins(expected: Float64Array): [number, number][] {
  const n = expected.length;
  let lo = 0;
  let acc = 0;
  while (lo < n && acc < MIN_EXPECTED) acc += expected[lo++];
  let hi = n;
  let accHi = 0;
  while (hi > lo && accHi < MIN_EXPECTED) accHi += expected[--hi];
  if (lo >= hi) return acc + accHi >= MIN_EXPECTED ? [[0, n]] : [];
  const out: [number, number][] = [[0, lo]];
  for (let i = lo; i < hi; i++) {
    if (expected[i] >= MIN_EXPECTED) out.push([i, i + 1]);
    else out[out.length - 1][1] = i + 1; // a thin inner bin joins its left neighbour
  }
  out.push([hi, n]);
  return out;
}

export interface Comparison {
  k: number;
  /** χ²/k of n₁₂ against n₁ + n₂, and the 0.1 %–99.9 % band of χ²ₖ/k it should fall in. */
  additive: number;
  band: [number, number];
  /** χ²/k of the same n₁₂ against an interference hypothesis, n₁ + n₂ + 2√(n₁n₂)·cos(2πy/Λ). */
  coherent: number;
}

/**
 * Compare the both-holes histogram with the sum of the one-hole histograms, and, as a power check,
 * with a coherent two-wave hypothesis of fringe period `period` (m) built from the same one-hole
 * counts: a test that cannot reject that hypothesis could not see interference if there were any.
 */
export function compare(g: Gun, n1: Float64Array, n2: Float64Array, n12: Float64Array,
  period: number): Comparison {
  const expected = new Float64Array(g.bins);
  for (let i = 0; i < g.bins; i++) expected[i] = n1[i] + n2[i];
  const groups = mergedBins(expected);
  let chi = 0;
  let chiCoh = 0;
  for (const [from, to] of groups) {
    let a = 0;
    let b = 0;
    let c = 0;
    let coh = 0;
    for (let i = from; i < to; i++) {
      a += n12[i];
      b += n1[i];
      c += n2[i];
      const y = -g.Y + ((i + 0.5) / g.bins) * 2 * g.Y;
      coh += n1[i] + n2[i] + 2 * Math.sqrt(n1[i] * n2[i]) * Math.cos((2 * Math.PI * y) / period);
    }
    const variance = Math.max(1, a + b + c);
    chi += (a - b - c) ** 2 / variance;
    chiCoh += (a - coh) ** 2 / variance;
  }
  const k = groups.length;
  return { k, additive: chi / k, band: chiSquareBand(k), coherent: chiCoh / k };
}
