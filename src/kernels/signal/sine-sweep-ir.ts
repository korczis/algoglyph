import { mulberry32 } from '../../engines/signal/input';
import { addNoise } from '../../engines/signal/input';
import { MUL, type Meter, type SignalKernel, type View } from '../../engines/signal/trace';
import { fft, nextPow2 } from './_fft';

export const FS = 8000;
const T = 2;
const F1 = 20;
const F2 = 3900;

/** The exponential sweep sin(2π f1 L (e^{t/L} − 1)), L = T / ln(f2/f1), with short fades. */
export function sweep(fs = FS, t = T, f1 = F1, f2 = F2): { x: Float64Array; L: number } {
  const n = Math.round(fs * t);
  const L = t / Math.log(f2 / f1);
  const fadeIn = Math.round(0.05 * fs); const fadeOut = Math.round(0.01 * fs);
  const x = Float64Array.from({ length: n }, (_, i) => {
    const s = i / fs;
    let v = Math.sin(2 * Math.PI * f1 * L * (Math.exp(s / L) - 1));
    if (i < fadeIn) v *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeIn);
    if (i >= n - fadeOut) v *= 0.5 - 0.5 * Math.cos((Math.PI * (n - 1 - i)) / fadeOut);
    return v;
  });
  return { x, L };
}

/**
 * Farina's inverse filter: the sweep reversed in time, its amplitude falling by 6 dB per octave
 * as the reversed sweep descends (weight f/f2), which undoes the sweep's 1/f energy density.
 */
export function inverse(x: Float64Array, L: number, fs = FS): Float64Array {
  const n = x.length;
  return Float64Array.from({ length: n }, (_, i) => { const j = n - 1 - i; return x[j] * Math.exp((j - (n - 1)) / fs / L); });
}

/** Drive a stepped computation to its result in one go. */
function finish<T>(steps: Generator<null, T>): T {
  for (;;) { const r = steps.next(); if (r.done) return r.value; }
}

/** Linear convolution by FFT, pausing (`null`) after each transform. */
export function* convolveSteps(a: ArrayLike<number>, b: ArrayLike<number>, meter?: Meter): Generator<null, Float64Array> {
  const n = nextPow2(a.length + b.length - 1);
  const ar = new Float64Array(n); const ai = new Float64Array(n);
  const br = new Float64Array(n); const bi = new Float64Array(n);
  for (let i = 0; i < a.length; i++) ar[i] = a[i];
  for (let i = 0; i < b.length; i++) br[i] = b[i];
  fft(ar, ai, meter);
  yield null;
  fft(br, bi, meter);
  yield null;
  for (let k = 0; k < n; k++) {
    const r = ar[k] * br[k] - ai[k] * bi[k];
    ai[k] = ar[k] * bi[k] + ai[k] * br[k];
    ar[k] = r;
  }
  meter?.add(MUL, 4 * n);
  fft(ar, ai, meter, true);
  yield null;
  return ar.subarray(0, a.length + b.length - 1);
}

/** Linear convolution by FFT. */
export function convolve(a: ArrayLike<number>, b: ArrayLike<number>, meter?: Meter): Float64Array {
  return finish(convolveSteps(a, b, meter));
}

/**
 * Deconvolve a recorded response: convolve with the inverse filter and scale so that the sweep
 * convolved with its own inverse has unit gain at the band's geometric centre. The linear impulse
 * response starts at index x.length − 1 of the result; harmonic responses come earlier. Pauses
 * (`null`) between transforms.
 */
export function* deconvolveSteps(y: ArrayLike<number>, x: Float64Array, L: number, meter?: Meter, fs = FS): Generator<null, { h: Float64Array; zero: number }> {
  const inv = inverse(x, L, fs);
  const self = yield* convolveSteps(x, inv, meter);
  const n = nextPow2(self.length);
  const re = new Float64Array(n); const im = new Float64Array(n);
  re.set(self);
  fft(re, im, meter);
  yield null;
  const k = Math.round((Math.sqrt(F1 * F2) / fs) * n);
  const gain = Math.hypot(re[k], im[k]);
  const out = yield* convolveSteps(y, inv, meter);
  for (let i = 0; i < out.length; i++) out[i] /= gain;
  meter?.add(MUL, out.length);
  return { h: out, zero: x.length - 1 };
}

export function deconvolve(y: ArrayLike<number>, x: Float64Array, L: number, meter?: Meter, fs = FS): { h: Float64Array; zero: number } {
  return finish(deconvolveSteps(y, x, L, meter, fs));
}

/** A seeded room: a direct path and decaying reflections of alternating sign. */
export function room(seed: number): { taps: [number, number][]; fir: Float64Array } {
  const rnd = mulberry32(seed);
  const taps: [number, number][] = [[10 + Math.floor(rnd() * 20), 1]];
  let at = taps[0][0];
  for (let r = 1; r <= 5; r++) {
    at += 15 + Math.floor(rnd() * 60);
    taps.push([at, (r % 2 ? -1 : 1) * 0.7 ** r * (0.6 + 0.4 * rnd())]);
  }
  const fir = new Float64Array(at + 1);
  for (const [d, g] of taps) fir[d] = g;
  return { taps, fir };
}

const mag = (h: ArrayLike<number>, n: number, meter?: Meter) => {
  const re = new Float64Array(n); const im = new Float64Array(n);
  for (let i = 0; i < Math.min(n, h.length); i++) re[i] = h[i];
  fft(re, im, meter);
  return Float64Array.from({ length: n / 2 + 1 }, (_, k) => 20 * Math.log10(Math.max(1e-9, Math.hypot(re[k], im[k]))));
};

// An exponential sweep through a seeded room and a mild second-order nonlinearity; the inverse
// filter collapses the recording into the linear impulse response, with the distortion's own
// response arriving L·ln 2 earlier.
export const kernel: SignalKernel = {
  params: [
    { kind: 'range', key: 'nl', label: 'Second-order distortion', min: 0, max: 0.4, step: 0.02, value: 0.12 },
    { kind: 'range', key: 'snr', label: 'Recording SNR (dB)', min: 0, max: 80, step: 5, value: 50 },
  ],
  *run(params, seed, meter): Generator<View | null> {
    const rnd = mulberry32(seed ^ 0x5eed);
    const { x, L } = sweep();
    const { taps, fir } = room(seed);
    const nl = Number(params.nl);
    const lag2 = Math.round(L * Math.log(2) * FS);
    const before = Math.round(lag2 * 1.25);
    const after = fir.length + 120;
    const nf = 1024;
    const df = FS / nf;
    const mTrue = mag(fir, nf);
    const truePts = Array.from(mTrue, (v, k): [number, number] => [k * df, v]).slice(1);
    const marks = [{ at: before, label: 'linear' }, { at: before - lag2, label: '2nd harmonic' }];
    const recorded = x.length + fir.length - 1;
    const phases = [12, 12, 10];
    // each phase is recorded as soon as its data exists: the sweep, the room's response, the
    // deconvolution
    const view = (ph: number, s: number, y: Float64Array, done?: {
      window: Float64Array; mEst: Float64Array; stats: { label: string; value: string }[];
    }): View => {
      const f = s / phases[ph];
      return {
        layout: [[0], [1, 2]],
        panels: [
          { kind: 'lanes', title: ph === 0 ? 'Exponential sweep, 20 Hz to 3.9 kHz' : 'Sweep and the recorded response', upto: ph === 0 ? Math.ceil(f * recorded) : recorded, lanes: [
            { name: 'sweep', y: x, tone: 0.3 }, { name: 'recorded', y: y.subarray(0, ph === 1 ? Math.ceil(f * y.length) : y.length), tone: 0.8 }] },
          { kind: 'wave', title: 'Deconvolved: harmonic and linear responses', upto: done ? Math.ceil(f * done.window.length) : 0, series: [{ name: 'h', y: done?.window ?? new Float64Array(before + after), tone: 0.75 }], marks },
          { kind: 'spectrum', title: '|H|: true room and measured', fmax: FS / 2, fmin: 20, logx: true, floor: -30, ceil: 15, series: [
            { name: 'true', y: mTrue, tone: -1, alpha: 130 }, ...(done ? [{ name: 'measured', y: done.mEst, tone: 0.8 }] : [])] },
        ],
        stats: done ? done.stats : [{ label: 'Phase', value: ph === 0 ? 'playing the sweep' : 'recording the room' }],
        counts: meter.snapshot(),
        chart: { title: 'Room response', x: { label: 'frequency (Hz)', log: true }, y: { label: 'gain (dB)' }, series: [
          { name: 'true', points: truePts },
          ...(done ? [{ name: 'measured', points: Array.from(done.mEst, (v, k): [number, number] => [k * df, v]).slice(1) }] : [])] },
      };
    };
    for (let s = 1; s <= phases[0]; s++) yield view(0, s, new Float64Array(0));
    const driven = Float64Array.from(x, (v) => v + nl * v * v);
    const y = addNoise((yield* convolveSteps(driven, fir, meter)).slice(), rnd, Number(params.snr));
    for (let s = 1; s <= phases[1]; s++) yield view(1, s, y);
    const { h, zero } = yield* deconvolveSteps(y, x, L, meter);
    const window = h.subarray(zero - before, zero + after);
    let peak = zero;
    for (let i = zero - 50; i < zero + after; i++) if (Math.abs(h[i]) > Math.abs(h[peak])) peak = i;
    // the harmonic's response passes through the room too: it leads the linear response, whose
    // first peak is the direct path, by L·ln 2, not the deconvolution's time origin
    let h2 = peak - lag2 - 200;
    for (let i = peak - lag2 - 200; i < peak - lag2 + 200; i++) if (Math.abs(h[i]) > Math.abs(h[h2])) h2 = i;
    const est = h.subarray(zero, zero + fir.length + 64);
    const direct = h[zero + taps[0][0]];
    const ratioErr = Math.max(...taps.slice(1).map(([d, g]) => Math.abs(h[zero + d] / direct - g / taps[0][1])));
    const mEst = mag(est, nf, meter);
    let worst = 0;
    // compared away from the comb's deep notches, where a tiny absolute error is a large one in dB
    const top = Math.max(...mTrue);
    for (let k = Math.ceil(100 / df); k * df <= 3000; k++) if (mTrue[k] > top - 20) worst = Math.max(worst, Math.abs(mEst[k] - mTrue[k]));
    const stats = [
      { label: 'Direct path: measured vs true delay', value: `${peak - zero} vs ${taps[0][0]} samples` },
      { label: 'Reflection ratios, worst error', value: ratioErr.toFixed(4) },
      { label: '|H| error, 100 Hz to 3 kHz, within 20 dB of the peak', value: `${worst.toFixed(3)} dB` },
      { label: '2nd-harmonic response: measured vs L·ln 2', value: `${((peak - h2) / FS * 1000).toFixed(1)} vs ${(lag2 / FS * 1000).toFixed(1)} ms early` },
    ];
    for (let s = 1; s <= phases[2]; s++) yield view(2, s, y, { window, mEst, stats });
  },
};
