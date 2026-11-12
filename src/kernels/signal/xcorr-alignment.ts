import { addNoise, mulberry32 } from '../../engines/signal/input';
import { MUL, type Meter, type SignalKernel, type View } from '../../engines/signal/trace';
import { parabolic } from './_fft';

const N = 512;
const MAXLAG = 64;

/** Two captures of one band-limited burst, the second later by `delay` samples (exact, analytic). */
export function captures(seed: number, delay: number, snrDb: number): [Float64Array, Float64Array] {
  const rnd = mulberry32(seed);
  const parts = Array.from({ length: 40 }, () => ({ w: 2 * Math.PI * (0.02 + 0.3 * rnd()), ph: 2 * Math.PI * rnd(), a: 0.3 + rnd() }));
  const s = (t: number) => {
    const u = (t - N / 2) / (N * 0.22);
    const env = Math.exp(-u * u);
    let v = 0;
    for (const p of parts) v += p.a * Math.sin(p.w * t + p.ph);
    return env * v;
  };
  const a = Float64Array.from({ length: N }, (_, i) => s(i));
  const b = Float64Array.from({ length: N }, (_, i) => s(i - delay));
  return [addNoise(a, rnd, snrDb), addNoise(b, rnd, snrDb)];
}

/** r[l] = Σ a[n]·b[n+l] for one lag. */
export function correlateAt(a: Float64Array, b: Float64Array, l: number, meter?: Meter): number {
  let s = 0;
  const lo = Math.max(0, -l); const hi = Math.min(a.length, b.length - l);
  for (let n = lo; n < hi; n++) s += a[n] * b[n + l];
  meter?.add(MUL, Math.max(0, hi - lo));
  return s;
}

const sinc = (x: number) => (Math.abs(x) < 1e-12 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));

/** The band-limited interpolation r(τ) = Σ r[l]·sinc(τ − l) of correlation samples at lags. */
export function sincAt(r: ArrayLike<number>, lags: ArrayLike<number>, tau: number, meter?: Meter): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) s += r[i] * sinc(tau - lags[i]);
  meter?.add(MUL, 2 * r.length);
  return s;
}

/** The sub-sample peak: golden-section search of the sinc interpolation around the best lag. */
export function refine(r: ArrayLike<number>, lags: ArrayLike<number>, l0: number, meter?: Meter): number {
  let lo = l0 - 1; let hi = l0 + 1;
  const g = (Math.sqrt(5) - 1) / 2;
  let c = hi - g * (hi - lo); let d = lo + g * (hi - lo);
  let fc = sincAt(r, lags, c, meter); let fd = sincAt(r, lags, d, meter);
  for (let it = 0; it < 48; it++) {
    if (fc > fd) { hi = d; d = c; fd = fc; c = hi - g * (hi - lo); fc = sincAt(r, lags, c, meter); } else {
      lo = c; c = d; fc = fd; d = lo + g * (hi - lo); fd = sincAt(r, lags, d, meter);
    }
  }
  return (lo + hi) / 2;
}

/** Estimate the delay of b against a: integer peak, parabolic and sinc refinements. */
export function align(a: Float64Array, b: Float64Array, maxLag = MAXLAG, meter?: Meter): { lags: Int32Array; r: Float64Array; integer: number; parabola: number; sinc: number } {
  const lags = Int32Array.from({ length: 2 * maxLag + 1 }, (_, i) => i - maxLag);
  const r = Float64Array.from(lags, (l) => correlateAt(a, b, l, meter));
  let best = 0;
  for (let i = 0; i < r.length; i++) if (r[i] > r[best]) best = i;
  const parabola = lags[best] + (best > 0 && best < r.length - 1 ? parabolic(r[best - 1], r[best], r[best + 1]) : 0);
  return { lags, r, integer: lags[best], parabola, sinc: refine(r, lags, lags[best], meter) };
}

// Slide one capture over the other lag by lag; the correlation peaks at the delay, and the
// band-limited interpolation of its samples finds the peak between them.
export const kernel: SignalKernel = {
  params: [{ kind: 'range', key: 'snr', label: 'SNR (dB)', min: -5, max: 50, step: 1, value: 20 }],
  *run(params, seed, meter): Generator<View | null> {
    const rnd = mulberry32(seed);
    const delay = (rnd() * 2 - 1) * (MAXLAG * 0.6);
    const [a, b] = captures(seed + 1, delay, Number(params.snr));
    const lags = Int32Array.from({ length: 2 * MAXLAG + 1 }, (_, i) => i - MAXLAG);
    const r = new Float64Array(lags.length).fill(NaN);
    const scale = Math.max(...a.map(Math.abs)) * 1.1;
    const view = (i: number, extra?: { integer: number; parabola: number; sinc: number }): View => {
      const l = lags[i];
      const shifted = Float64Array.from({ length: N }, (_, n) => b[n + l] ?? 0);
      const known = Array.from(r, (v, k): [number, number] => [lags[k], v]).filter(([, v]) => Number.isFinite(v));
      const stats = [
        { label: 'Lag now', value: `${l} samples, r = ${r[i].toFixed(2)}` },
        { label: 'True delay', value: `${delay.toFixed(4)} samples` },
      ];
      const panels: View['panels'] = [
        { kind: 'wave', title: `Capture a and capture b moved back by lag ${l}`, range: [-scale, scale], series: [
          { name: 'a[n]', y: a, tone: 0.25 }, { name: 'b[n + lag]', y: shifted, tone: 0.8, alpha: 200 }] },
        { kind: 'wave', title: 'Cross-correlation r[lag]', upto: i + 1, series: [{ name: 'r', y: r.map((v) => (Number.isFinite(v) ? v : 0)), stems: true, tone: 0.6 }],
          marks: [{ at: MAXLAG + delay, label: 'true' }] },
      ];
      if (extra) {
        const c = extra.integer;
        const curve: number[] = [];
        for (let t = c - 3; t <= c + 3; t += 0.02) curve.push(t, sincAt(r, lags, t));
        const ys = curve.filter((_, k) => k % 2 === 1);
        const lo = Math.min(...ys); const hi = Math.max(...ys);
        panels.push({ kind: 'xy', title: 'Near the peak: samples, sinc interpolation, estimates', range: [c - 3, c + 3, lo - 0.1 * (hi - lo), hi + 0.15 * (hi - lo)], xLabel: 'lag (samples)',
          lines: [{ pts: curve, tone: 0.6 },
            { pts: [delay, lo, delay, hi], tone: -1, weight: 1, alpha: 140 },
            { pts: [extra.sinc, lo, extra.sinc, hi], tone: 0.85, weight: 1.5 },
            { pts: [extra.parabola, lo, extra.parabola, hi], tone: 0.2, weight: 1.5 }],
          dots: Array.from(lags).map((l2, k) => ({ x: l2, y: r[k], tone: 0.6, r: 3.5 })).filter((d) => Math.abs(d.x - c) <= 3),
          labels: [{ x: delay, y: hi, text: 'true' }, { x: extra.sinc, y: lo + 0.8 * (hi - lo), text: 'sinc' }, { x: extra.parabola, y: lo + 0.6 * (hi - lo), text: 'parabola' }] });
        stats.push(
          { label: 'Integer peak', value: `${extra.integer} (error ${(extra.integer - delay).toFixed(4)})` },
          { label: 'Parabolic estimate', value: `${extra.parabola.toFixed(4)} (error ${(extra.parabola - delay).toFixed(4)})` },
          { label: 'Sinc-interpolated estimate', value: `${extra.sinc.toFixed(4)} (error ${(extra.sinc - delay).toFixed(4)})` },
        );
      }
      return {
        layout: extra ? [[0], [1, 2]] : [[0], [1]], panels, stats, counts: meter.snapshot(),
        chart: { title: 'Cross-correlation', x: { label: 'lag (samples)' }, y: { label: 'r' }, series: [{ name: 'r[lag]', points: known }] },
      };
    };
    for (let i = 0; i < lags.length; i++) {
      r[i] = correlateAt(a, b, lags[i], meter);
      if (i % 3 === 0) yield view(i);
    }
    let best = 0;
    for (let i = 0; i < r.length; i++) if (r[i] > r[best]) best = i;
    const parabola = lags[best] + parabolic(r[best - 1] ?? r[best], r[best], r[best + 1] ?? r[best]);
    const est = { integer: lags[best], parabola, sinc: refine(r, lags, lags[best], meter) };
    for (let k = 0; k < 6; k++) yield view(best, est);
  },
};
