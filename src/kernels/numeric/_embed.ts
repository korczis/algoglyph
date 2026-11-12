// Delay embedding and the measurements built on it: average mutual information for the delay,
// false nearest neighbours for the dimension.
import { drain } from '../../engines/numeric/trace';

/** Vectors (s_i, s_{i+τ}, ..., s_{i+(m-1)τ}). */
export function embed(s: number[], m: number, tau: number): number[][] {
  const n = s.length - (m - 1) * tau;
  return Array.from({ length: Math.max(0, n) }, (_, i) => Array.from({ length: m }, (_, k) => s[i + k * tau]));
}

/** Mutual information (nats) between s_i and s_{i+lag}, from a bins × bins histogram. */
export function mutualInformation(s: number[], lag: number, bins = 16): number {
  const lo = Math.min(...s); const hi = Math.max(...s);
  const b = (v: number) => Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo || 1)) * bins));
  const n = s.length - lag;
  const joint = new Float64Array(bins * bins); const px = new Float64Array(bins); const py = new Float64Array(bins);
  for (let i = 0; i < n; i++) { const p = b(s[i]); const q = b(s[i + lag]); joint[p * bins + q]++; px[p]++; py[q]++; }
  let mi = 0;
  for (let p = 0; p < bins; p++) for (let q = 0; q < bins; q++) {
    const j = joint[p * bins + q];
    if (j) mi += (j / n) * Math.log((j * n) / (px[p] * py[q]));
  }
  return mi;
}

/** The first lag at which the mutual information stops falling. */
export function firstMinimum(values: number[]): number {
  for (let i = 1; i < values.length - 1; i++) if (values[i] <= values[i - 1] && values[i] < values[i + 1]) return i;
  return values.length - 1;
}

/**
 * Fraction of nearest neighbours in dimension m that fly apart when the (m+1)-th delay is added
 * (both tests of Kennel, Brown and Abarbanel, with thresholds rtol and atol).
 */
export function falseNeighbours(s: number[], m: number, tau: number, rtol = 15, atol = 2): number {
  return drain(falseNeighbourSteps(s, m, tau, rtol, atol));
}

/** falseNeighbours(), resumable: it yields after every 64 points searched. */
export function* falseNeighbourSteps(s: number[], m: number, tau: number, rtol = 15, atol = 2): Generator<void, number, void> {
  const v = embed(s, m + 1, tau);
  const n = v.length;
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const ra = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
  let falses = 0; let total = 0;
  for (let i = 0; i < n; i++) {
    let best = Infinity; let j = -1;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      let d = 0;
      for (let c = 0; c < m; c++) { const e = v[i][c] - v[k][c]; d += e * e; if (d >= best) break; }
      if (d < best && d > 0) { best = d; j = k; }
    }
    if (j < 0) continue;
    total++;
    const extra = Math.abs(v[i][m] - v[j][m]);
    const rd = Math.sqrt(best);
    const r1 = Math.sqrt(best + extra * extra);
    if (extra / rd > rtol || r1 / ra > atol) falses++;
    if ((i & 63) === 63) yield;
  }
  return total ? falses / total : 0;
}
