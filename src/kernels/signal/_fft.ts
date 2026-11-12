// The radix-2 FFT every spectral kernel shares, with its work metered: one butterfly per pair
// combined, four real multiplies per twiddle product. Windows and spectra built on it.
import { BUTTERFLY, MUL, type Meter } from '../../engines/signal/trace';

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** Reorder in place by bit-reversed index, the shuffle that lets the butterflies run in place. */
export function bitReverse(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
}

/**
 * In-place iterative radix-2 FFT, X_k = Σ x_n e^{∓2πikn/N} (unnormalised both ways; the inverse
 * divides by N). `onStage(s)` is called after each of the log2 N stages.
 */
export function fft(re: Float64Array, im: Float64Array, meter?: Meter, inverse = false,
  onStage?: (stage: number) => void): void {
  const n = re.length;
  if (n & (n - 1)) throw new RangeError(`fft: length ${n} is not a power of two`);
  bitReverse(re, im);
  const sign = inverse ? 1 : -1;
  let stage = 0;
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (sign * 2 * Math.PI) / len;
    for (let k = 0; k < half; k++) {
      const wr = Math.cos(ang * k);
      const wi = Math.sin(ang * k);
      for (let i = k; i < n; i += len) {
        const j = i + half;
        const tr = wr * re[j] - wi * im[j];
        const ti = wr * im[j] + wi * re[j];
        re[j] = re[i] - tr; im[j] = im[i] - ti;
        re[i] += tr; im[i] += ti;
      }
    }
    meter?.add(BUTTERFLY, n / 2);
    meter?.add(MUL, 2 * n);
    onStage?.(++stage);
  }
  if (inverse) {
    for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    meter?.add(MUL, 2 * n);
  }
}

export interface WindowDef { id: string; label: string; coef: number[] }

/** Cosine-sum windows w[n] = Σ (-1)^k a_k cos(2πkn/N), periodic (DFT-even). */
export const WINDOWS: WindowDef[] = [
  { id: 'rect', label: 'Rectangular', coef: [1] },
  { id: 'hann', label: 'Hann', coef: [0.5, 0.5] },
  { id: 'hamming', label: 'Hamming', coef: [0.54, 0.46] },
  { id: 'blackman', label: 'Blackman', coef: [0.42, 0.5, 0.08] },
  { id: 'blackman-harris', label: 'Blackman-Harris', coef: [0.35875, 0.48829, 0.14128, 0.01168] },
];

export function windowOf(id: string, n: number): Float64Array {
  const def = WINDOWS.find((w) => w.id === id) ?? WINDOWS[1];
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    def.coef.forEach((a, k) => { v += (k % 2 ? -a : a) * Math.cos((2 * Math.PI * k * i) / n); });
    w[i] = v;
  }
  return w;
}

/**
 * Amplitude spectrum of x[from .. from+len) times window w, zero-padded to nfft: bins 0..nfft/2,
 * scaled so that a sinusoid of amplitude A on a bin reads A.
 */
export function amplitude(x: ArrayLike<number>, w: Float64Array, nfft: number, meter?: Meter,
  from = 0): Float64Array {
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  let gain = 0;
  for (let i = 0; i < w.length; i++) { re[i] = (x[from + i] ?? 0) * w[i]; gain += w[i]; }
  meter?.add(MUL, w.length);
  fft(re, im, meter);
  const out = new Float64Array(nfft / 2 + 1);
  for (let k = 0; k <= nfft / 2; k++) out[k] = ((k === 0 || k === nfft / 2 ? 1 : 2) * Math.hypot(re[k], im[k])) / gain;
  meter?.add(MUL, nfft + 2);
  return out;
}

/** Amplitude in dB (re 1). */
export function toDb(a: ArrayLike<number>, floor = -160): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] > 0 ? Math.max(floor, 20 * Math.log10(a[i])) : floor;
  return out;
}

/** Index of the largest value in [from, to). */
export function argmax(a: ArrayLike<number>, from = 0, to = a.length): number {
  let best = from;
  for (let i = from; i < to; i++) if (a[i] > a[best]) best = i;
  return best;
}

/** Vertex offset in (-0.5, 0.5) of the parabola through three neighbouring values. */
export function parabolic(a: number, b: number, c: number): number {
  const d = a - 2 * b + c;
  return d === 0 ? 0 : (0.5 * (a - c)) / d;
}

/**
 * Welch's averaged periodogram: frames of `frame` samples, hop `hop`, window w; returns the mean
 * power per bin (one-sided, bins 0..frame/2) and the number of frames averaged.
 */
export function welch(x: ArrayLike<number>, frame: number, hop: number, w: Float64Array,
  meter?: Meter): { psd: Float64Array; frames: number } {
  const psd = new Float64Array(frame / 2 + 1);
  let frames = 0;
  let u = 0;
  for (let i = 0; i < frame; i++) u += w[i] * w[i];
  for (let from = 0; from + frame <= x.length; from += hop) {
    const re = new Float64Array(frame);
    const im = new Float64Array(frame);
    for (let i = 0; i < frame; i++) re[i] = x[from + i] * w[i];
    meter?.add(MUL, frame);
    fft(re, im, meter);
    for (let k = 0; k <= frame / 2; k++) psd[k] += (re[k] * re[k] + im[k] * im[k]) / u;
    meter?.add(MUL, frame + 2);
    frames++;
  }
  if (frames) for (let k = 0; k < psd.length; k++) psd[k] /= frames;
  return { psd, frames };
}
