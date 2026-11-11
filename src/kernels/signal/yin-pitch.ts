import { gaussian } from '../../core/random';
import { mulberry32 } from '../../engines/signal/input';
import { chartPoints, FRAME, MUL, type Meter, type SignalKernel, type View } from '../../engines/signal/trace';
import { parabolic } from './_fft';

export const FS = 16000;
const W = 512;
const TAU_MAX = 400;
const HOP = 256;

export interface Pitch { f: number; tau: number; aperiodicity: number; dprime: Float64Array }

/**
 * YIN on the frame starting at `from`: the difference function d(τ), its cumulative mean
 * normalisation d'(τ), the first dip below the threshold followed to its local minimum, and a
 * parabola through the neighbours for the sub-sample period.
 */
export function yin(x: ArrayLike<number>, from: number, fs: number, thr = 0.1, w = W, tauMax = TAU_MAX, meter?: Meter): Pitch {
  const d = new Float64Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < w; j++) { const e = x[from + j] - x[from + j + tau]; s += e * e; }
    d[tau] = s;
  }
  meter?.add(MUL, w * tauMax);
  const dp = new Float64Array(tauMax + 1);
  dp[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; dp[tau] = run > 0 ? (d[tau] * tau) / run : 1; }
  meter?.add(MUL, 2 * tauMax);
  let tau = -1;
  for (let t = 2; t < tauMax; t++) {
    if (dp[t] < thr) { while (t + 1 < tauMax && dp[t + 1] < dp[t]) t++; tau = t; break; }
  }
  if (tau < 0) { tau = 2; for (let t = 2; t < tauMax; t++) if (dp[t] < dp[tau]) tau = t; }
  const off = tau > 1 && tau < tauMax ? parabolic(dp[tau - 1], dp[tau], dp[tau + 1]) : 0;
  const period = tau + off;
  return { f: fs / period, tau: period, aperiodicity: dp[tau], dprime: dp };
}

/** A gliding, vibrating harmonic tone and its true fundamental at every sample. */
export function voice(n: number, f0: number, glide: number, vibCents: number, snrDb: number, seed: number): { x: Float64Array; f: Float64Array } {
  const rnd = mulberry32(seed);
  const amps = Array.from({ length: 6 }, (_, h) => (0.4 + 0.6 * rnd()) / (h + 1));
  const x = new Float64Array(n); const f = new Float64Array(n);
  let ph = 0; let pw = 0;
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    f[i] = f0 * 2 ** ((glide * (i / n)) / 12) * 2 ** ((vibCents / 1200) * Math.sin(2 * Math.PI * 5 * t));
    let v = 0;
    for (let h = 0; h < amps.length; h++) if ((h + 1) * f[i] < FS / 2) v += amps[h] * Math.sin((h + 1) * ph);
    x[i] = v; pw += v * v;
    ph += (2 * Math.PI * f[i]) / FS;
  }
  const sigma = Math.sqrt(pw / n / 10 ** (snrDb / 10));
  for (let i = 0; i < n; i++) x[i] += sigma * gaussian(rnd);
  return { x, f };
}

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

// Frame by frame: the cumulative-mean-normalised difference function dips at the period, and
// its first dip under the threshold is the fundamental rather than an octave below or above.
export const kernel: SignalKernel = {
  rate: 14,
  params: [
    { kind: 'range', key: 'f0', label: 'Starting pitch (Hz)', min: 60, max: 800, step: 5, value: 196 },
    { kind: 'range', key: 'glide', label: 'Glide (semitones)', min: -12, max: 12, step: 1, value: 7 },
    { kind: 'range', key: 'vib', label: 'Vibrato depth (cents)', min: 0, max: 100, step: 5, value: 30 },
    { kind: 'range', key: 'snr', label: 'SNR (dB)', min: 0, max: 60, step: 1, value: 25 },
    { kind: 'range', key: 'thr', label: 'Threshold', min: 0.02, max: 0.5, step: 0.01, value: 0.1 },
  ],
  run(params, seed, meter): View[] {
    const n = Math.round(1.5 * FS);
    const { x, f } = voice(n, Number(params.f0), Number(params.glide), Number(params.vib), Number(params.snr), seed);
    const thr = Number(params.thr);
    const track = new Float64Array(Math.floor((n - W - TAU_MAX) / HOP) + 1).fill(NaN);
    const truth = Float64Array.from(track, (_, k) => f[k * HOP + W / 2]);
    const errs: number[] = [];
    let gross = 0;
    const views: View[] = [];
    for (let k = 0; k < track.length; k++) {
      const from = k * HOP;
      const p = yin(x, from, FS, thr, W, TAU_MAX, meter);
      meter.add(FRAME);
      track[k] = p.f;
      const e = cents(p.f, truth[k]);
      errs.push(Math.abs(e));
      if (Math.abs(e) > 50) gross++;
      const sorted = errs.slice().sort((a, b) => a - b);
      const known: [number, number][] = [];
      for (let j = 0; j <= k; j++) known.push([(j * HOP + W / 2) / FS, track[j]]);
      const lo = Math.min(...truth) / 1.6; const hi = Math.max(...truth) * 1.4;
      views.push({
        layout: [[0, 1], [2]],
        panels: [
          { kind: 'wave', title: `Frame at ${((from + W / 2) / FS).toFixed(3)} s`, series: [{ name: 'x', y: x.subarray(from, from + W + TAU_MAX), tone: 0.7 }],
            marks: [{ at: 0 }, { at: p.tau, label: 'one period' }] },
          { kind: 'wave', title: "d'(τ), the cumulative mean normalised difference", range: [0, 1.6], series: [
            { name: "d'(τ)", y: p.dprime, tone: 0.3 }, { name: 'threshold', y: new Float64Array(p.dprime.length).fill(thr), tone: -1, alpha: 110 }],
            marks: [{ at: p.tau, label: `τ = ${p.tau.toFixed(2)}` }] },
          { kind: 'wave', title: 'Pitch track (Hz): detected and true', upto: k + 1, range: [lo, hi], series: [
            { name: 'true', y: truth, tone: -1, alpha: 130 }, { name: 'YIN', y: track.map((v) => (Number.isFinite(v) ? v : truth[0])), tone: 0.85 }] },
        ],
        stats: [
          { label: 'Detected vs true', value: `${p.f.toFixed(2)} vs ${truth[k].toFixed(2)} Hz` },
          { label: 'Error now', value: `${e.toFixed(1)} cents` },
          { label: 'Median error so far', value: `${sorted[sorted.length >> 1].toFixed(2)} cents` },
          { label: 'Gross errors (> 50 cents)', value: `${gross} of ${k + 1} frames` },
          { label: "Aperiodicity d'(τ)", value: p.aperiodicity.toFixed(3) },
        ],
        counts: meter.snapshot(),
        chart: { title: 'Pitch track', x: { label: 'time (s)' }, y: { label: 'frequency (Hz)' }, series: [
          { name: 'YIN', points: known },
          { name: 'true', points: chartPoints(truth, (j) => (j * HOP + W / 2) / FS, 400, 0, k + 1) }] },
      });
    }
    return views;
  },
};
