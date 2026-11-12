import { str } from '../../core/plate';
import { MUL, type Meter, type SignalKernel, type View } from '../../engines/signal/trace';
import { fft, toDb } from './_fft';

const FS = 8192;
const N = 8192; // one second: every carrier and sideband falls exactly on a bin
const FC = 2000;
const ORDERS = 8;

/** Bessel function of the first kind J_n(x), n ≥ 0, by its power series. */
export function besselJ(n: number, x: number): number {
  let term = (x / 2) ** n;
  for (let k = 1; k <= n; k++) term /= k;
  let sum = term;
  for (let m = 1; m < 80; m++) {
    term *= -((x / 2) ** 2) / (m * (m + n));
    sum += term;
    if (Math.abs(term) < 1e-17 * Math.max(1, Math.abs(sum))) break;
  }
  return sum;
}

/** y = sin(2π fc t + β sin(2π fm t)), sampled for one second. */
export function fmTone(fm: number, beta: number, meter?: Meter): Float64Array {
  const y = Float64Array.from({ length: N }, (_, i) => {
    const t = i / FS;
    return Math.sin(2 * Math.PI * FC * t + beta * Math.sin(2 * Math.PI * fm * t));
  });
  meter?.add(MUL, 4 * N);
  return y;
}

/**
 * Amplitude of every bin of one second of signal: a sinusoid of amplitude A reads A, and so
 * does a constant A in bin 0 or a cosine A·cos(πn) in the Nyquist bin, which have no mirror image
 * to share their power with.
 */
export function spectrum(y: Float64Array, meter?: Meter): Float64Array {
  const re = Float64Array.from(y); const im = new Float64Array(N);
  fft(re, im, meter);
  meter?.add(MUL, N);
  return Float64Array.from({ length: N / 2 + 1 }, (_, k) => ((k === 0 || k === N / 2 ? 1 : 2) * Math.hypot(re[k], im[k])) / N);
}

/**
 * Where a sine at f Hz lands once sampled at FS: the bin it reads in, and the sign it reads with.
 * Below zero or above the Nyquist frequency it folds back inverted (sin(−x) = −sin x); exactly on
 * zero or on the Nyquist frequency every sample is sin(πk) = 0, so it vanishes (sign 0).
 */
export function alias(f: number): { bin: number; sign: number } {
  const g = ((f % FS) + FS) % FS;
  if (g === 0 || g === FS / 2) return { bin: g, sign: 0 };
  return g < FS / 2 ? { bin: g, sign: 1 } : { bin: FS - g, sign: -1 };
}

/**
 * The amplitudes the series predicts at fc + n·fm, n = -orders .. orders: every Bessel term
 * J_m(β)·sin(2π(fc + m·fm)t), m = -M .. M with J_-m = (-1)^m J_m, added into the bin it folds to.
 */
export function predicted(fm: number, beta: number, orders = ORDERS, M = 64): number[] {
  const acc = new Map<number, number>();
  for (let m = -M; m <= M; m++) {
    const { bin, sign } = alias(FC + m * fm);
    const j = (m < 0 && m % 2 ? -1 : 1) * besselJ(Math.abs(m), beta);
    acc.set(bin, (acc.get(bin) ?? 0) + sign * j);
  }
  return Array.from({ length: 2 * orders + 1 }, (_, i) => Math.abs(acc.get(alias(FC + (i - orders) * fm).bin) ?? 0));
}

/** Measured amplitudes at fc + n·fm for n = -orders .. orders. */
export function sidebands(fm: number, beta: number, orders = ORDERS, meter?: Meter): number[] {
  const a = spectrum(fmTone(fm, beta, meter), meter);
  return Array.from({ length: 2 * orders + 1 }, (_, i) => a[FC + (i - orders) * fm] ?? 0);
}

// The carrier's frequency swings by β·fm; the spectrum is a carrier and sidebands fm apart,
// the n-th weighted by |J_n(β)|. The plate sweeps the index up to the chosen β.
export const kernel: SignalKernel = {
  rate: 5,
  params: [
    { kind: 'select', key: 'fm', label: 'Modulator (Hz)', value: '125', options: ['100', '125', '200', '250'].map((v) => ({ value: v, label: `${v} Hz` })) },
    { kind: 'range', key: 'beta', label: 'Largest modulation index β', min: 0.5, max: 6, step: 0.1, value: 5 },
  ],
  *run(params, _seed, meter): Generator<View | null> {
    const fm = Number(str(params, 'fm'));
    const bmax = Number(params.beta);
    const steps = 30;
    const curves = [0, 1, 2, 3].map((n) => {
      const pts: number[] = [];
      for (let i = 0; i <= 120; i++) { const b = (i / 120) * bmax; pts.push(b, besselJ(n, b)); }
      return { pts, tone: 0.15 + 0.25 * n, weight: 1.3, alpha: 200 };
    });
    for (let s = 0; s <= steps; s++) {
      const beta = (s / steps) * bmax;
      const y = fmTone(fm, beta, meter);
      const a = spectrum(y, meter);
      const side = Array.from({ length: 2 * ORDERS + 1 }, (_, i) => a[FC + (i - ORDERS) * fm] ?? 0);
      const want = predicted(fm, beta);
      let worst = 0;
      side.forEach((v, i) => { worst = Math.max(worst, Math.abs(v - want[i])); });
      // the band holding 99 % of the power, measured from the spectrum outward from the carrier
      let total = 0;
      for (let k = 0; k < a.length; k++) total += a[k] * a[k];
      let band = 0; let inside = a[FC] ** 2;
      while (inside < 0.99 * total && band < FC) { band++; inside += (a[FC - band] ?? 0) ** 2 + (a[FC + band] ?? 0) ** 2; }
      const show = 320;
      const mod = Float64Array.from({ length: show }, (_, i) => Math.sin(2 * Math.PI * fm * i / FS));
      yield {
        layout: [[0], [1, 2]],
        panels: [
          { kind: 'wave', title: `Carrier ${FC} Hz, modulator ${fm} Hz, β = ${beta.toFixed(2)} (first ${(1000 * show / FS).toFixed(0)} ms)`, series: [
            { name: 'modulator', y: mod, tone: 0.25, alpha: 150 }, { name: 'FM output', y: y.subarray(0, show), tone: 0.8 }] },
          { kind: 'spectrum', title: 'Spectrum (1 Hz bins)', fmax: FS / 2, floor: -80, ceil: 0, series: [{ name: '|Y|', y: toDb(a, -80), tone: 0.75 }],
            marks: [{ at: FC, label: 'fc' }] },
          { kind: 'xy', title: 'J0..J3 against β; dots: measured sidebands', range: [0, bmax, -0.5, 1.05], xLabel: 'β', lines: curves,
            dots: [0, 1, 2, 3].map((n) => ({ x: beta, y: Math.sign(besselJ(n, beta)) * side[ORDERS + n], tone: 0.15 + 0.25 * n, r: 4 })),
            labels: [0, 1, 2, 3].map((n) => ({ x: bmax * 0.02 + n * bmax * 0.08, y: 1.0, text: `J${n}` })) },
        ],
        stats: [
          { label: 'Modulation index β', value: beta.toFixed(2) },
          { label: 'Carrier: measured vs |J0(β)|', value: `${side[ORDERS].toFixed(4)} vs ${Math.abs(besselJ(0, beta)).toFixed(4)}` },
          { label: 'First sideband: measured vs |J1(β)|', value: `${side[ORDERS + 1].toFixed(4)} vs ${Math.abs(besselJ(1, beta)).toFixed(4)}` },
          { label: 'Largest disagreement with the folded series', value: worst.toExponential(2) },
          { label: '99 % power bandwidth (measured)', value: `${2 * band} Hz` },
          { label: "Carson's rule 2(β+1)fm", value: `${(2 * (beta + 1) * fm).toFixed(0)} Hz` },
          { label: 'Total power (Parseval, ideal 1)', value: total.toFixed(4) },
        ],
        counts: meter.snapshot(),
        chart: { title: 'Sideband amplitudes', x: { label: 'sideband order n' }, y: { label: 'amplitude' }, series: [
          { name: 'measured', points: side.map((v, i) => [i - ORDERS, v]) },
          { name: 'series Σ J_m(β), folded into each bin', points: want.map((v, i) => [i - ORDERS, v]) }] },
      };
    }
  },
};
