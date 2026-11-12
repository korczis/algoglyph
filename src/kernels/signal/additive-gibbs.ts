import { bool, str } from '../../core/plate';
import { MUL, type Meter, type SignalKernel, type View } from '../../engines/signal/trace';

const P = 4096; // samples per period

export type Wave = 'square' | 'saw' | 'triangle';

/** Fourier-series amplitude b_k of sin(2πkt) for each shape (unit peak, jump 2 where it jumps). */
export function coefficient(shape: Wave, k: number): number {
  if (shape === 'saw') return ((k % 2 ? 1 : -1) * 2) / (Math.PI * k);
  if (k % 2 === 0) return 0;
  if (shape === 'triangle') return (((k - 1) / 2) % 2 ? -1 : 1) * 8 / (Math.PI * Math.PI * k * k);
  return 4 / (Math.PI * k);
}

export function ideal(shape: Wave, t: number): number {
  const u = t - Math.floor(t);
  if (shape === 'square') return u < 0.5 ? 1 : -1;
  if (shape === 'saw') return u < 0.5 ? 2 * u : 2 * u - 2;
  return u < 0.25 ? 4 * u : u < 0.75 ? 2 - 4 * u : 4 * u - 4;
}

const tables = new Map<number, Float64Array>();
/** sin(2πi/n) for one period, so that sin(2πki/n) is a lookup at (k·i) mod n. */
function sines(n: number): Float64Array {
  let t = tables.get(n);
  if (!t) { t = Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * i) / n)); tables.set(n, t); }
  return t;
}

/** The sum of the first K harmonics over one period, optionally Lanczos σ-weighted. */
export function partialSum(shape: Wave, K: number, sigma = false, n = P, meter?: Meter): Float64Array {
  const y = new Float64Array(n);
  for (let k = 1; k <= K; k++) {
    let b = coefficient(shape, k);
    if (!b) continue;
    if (sigma) { const u = (Math.PI * k) / (K + 1); b *= Math.sin(u) / u; }
    const table = sines(n);
    for (let i = 0; i < n; i++) y[i] += b * table[(k * i) % n];
    meter?.add(MUL, n);
  }
  return y;
}

/** The largest excess of the partial sum over the ideal wave on its upper half, as a fraction of
 * the jump (2); the samples at the jump itself, where the ideal changes sides, are excluded. */
export function overshoot(shape: Wave, y: Float64Array): number {
  let mx = 0;
  for (let i = 0; i < y.length; i++) {
    const v = ideal(shape, i / y.length);
    if (v >= 0) mx = Math.max(mx, y[i] - v);
  }
  return mx / 2;
}

/** Si(π) = ∫0^π sin(t)/t dt, by Simpson's rule. */
function siPi(): number {
  const m = 2000; const h = Math.PI / m;
  let s = 1 + Math.sin(Math.PI) / Math.PI;
  for (let i = 1; i < m; i++) { const t = i * h; s += (i % 2 ? 4 : 2) * (Math.sin(t) / t); }
  return (s * h) / 3;
}

// Harmonics added one at a time: the partial sum converges everywhere except at the jump, where
// the first ripple keeps about nine per cent of the jump however many harmonics are added.
export const kernel: SignalKernel = {
  params: [
    { kind: 'select', key: 'shape', label: 'Waveform', value: 'square', options: [
      { value: 'square', label: 'Square' }, { value: 'saw', label: 'Sawtooth' }, { value: 'triangle', label: 'Triangle (no jump)' }] },
    { kind: 'range', key: 'K', label: 'Harmonics, at most', min: 5, max: 151, step: 2, value: 61 },
    { kind: 'toggle', key: 'sigma', label: 'Lanczos σ factors', value: false },
  ],
  *run(params, _seed, meter): Generator<View | null> {
    const shape = str(params, 'shape') as Wave;
    const Kmax = Number(params.K);
    const sigma = bool(params, 'sigma');
    const limit = 100 * (siPi() / Math.PI - 0.5);
    const truth = Float64Array.from({ length: P }, (_, i) => ideal(shape, i / P));
    const amps = Float64Array.from({ length: Kmax + 1 }, (_, k) => (k ? Math.abs(coefficient(shape, k)) : 0));
    const history: [number, number][] = [];
    const Ks: number[] = [];
    for (let K = 1; K <= Kmax; K += K < 15 ? 1 : 2) Ks.push(K);
    if (Ks[Ks.length - 1] !== Kmax) Ks.push(Kmax);
    for (const K of Ks) {
      const y = partialSum(shape, K, sigma, P, meter);
      const os = 100 * overshoot(shape, y);
      history.push([K, os]);
      let err = 0;
      for (let i = 0; i < P; i++) err += (y[i] - truth[i]) ** 2;
      err = Math.sqrt(err / P);
      // the neighbourhood of the jump at t = 0.5 (square) or t = 0.5 (saw), up close
      const lo = Math.floor(P * 0.47); const hi = Math.floor(P * 0.53);
      const zoom: number[] = []; const zt: number[] = [];
      for (let i = lo; i < hi; i++) { zoom.push(i / P, y[i]); zt.push(i / P, truth[i]); }
      const peak = 1 + (2 * os) / 100;
      yield {
        layout: [[0], [1, 2]],
        panels: [
          { kind: 'wave', title: `${K} harmonic${K > 1 ? 's' : ''}${sigma ? ', σ-weighted' : ''}, one period`, range: [-1.35, 1.35], series: [
            { name: 'ideal', y: truth, tone: -1, alpha: 110 }, { name: 'partial sum', y, tone: 0.8 }] },
          { kind: 'wave', title: 'Harmonic amplitudes |b_k|', series: [{ name: '|b_k|', y: amps.subarray(0, K + 1), stems: true, tone: 0.3 }] },
          { kind: 'xy', title: 'Close to the jump', range: [lo / P, hi / P, -1.35, 1.35], lines: [
            { pts: zt, tone: -1, alpha: 110 }, { pts: zoom, tone: 0.8, weight: 1.8 },
            { pts: [lo / P, peak, hi / P, peak], tone: 0.3, weight: 1, alpha: 150 }] },
        ],
        stats: [
          { label: 'Harmonics summed', value: String(K) },
          { label: 'Overshoot (measured, share of the jump)', value: shape === 'triangle' ? `${os.toFixed(3)} % (no jump)` : `${os.toFixed(3)} %` },
          { label: 'Gibbs limit Si(π)/π − 1/2', value: `${limit.toFixed(3)} %` },
          { label: 'RMS error against the ideal', value: err.toFixed(4) },
        ],
        counts: meter.snapshot(),
        chart: { title: 'Overshoot as harmonics are added', x: { label: 'harmonics K' }, y: { label: 'overshoot (% of jump)' }, series: [
          { name: 'measured', points: history.slice() }] },
      };
    }
  },
};
