// Seeded synthetic signals: every input a signal kernel sees is made here from a seed, so a URL
// with ?seed= reproduces the run, and every test knows the truth the kernel has to recover.
import { gaussian, mulberry32 } from '../../core/random';

export interface Partial { f: number; a: number; ph?: number }

/** A sum of sinusoids a·sin(2πft + ph), sampled at fs. */
export function tones(n: number, fs: number, parts: Partial[], delay = 0): Float64Array {
  const x = new Float64Array(n);
  for (const { f, a, ph = 0 } of parts) {
    const w = (2 * Math.PI * f) / fs;
    for (let i = 0; i < n; i++) x[i] += a * Math.sin(w * (i - delay) + ph);
  }
  return x;
}

/** A linear chirp from f0 to f1 Hz over the n samples. */
export function chirp(n: number, fs: number, f0: number, f1: number, a = 1): Float64Array {
  const x = new Float64Array(n);
  const T = n / fs;
  const k = (f1 - f0) / T;
  for (let i = 0; i < n; i++) {
    const t = i / fs;
    x[i] = a * Math.sin(2 * Math.PI * (f0 * t + 0.5 * k * t * t));
  }
  return x;
}

/** The instantaneous frequency of `chirp` at sample i. */
export function chirpFreq(n: number, _fs: number, f0: number, f1: number, i: number): number {
  return f0 + ((f1 - f0) * i) / n;
}

/** White Gaussian noise of standard deviation sigma. */
export function noise(n: number, rnd: () => number, sigma = 1): Float64Array {
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = sigma * gaussian(rnd);
  return x;
}

export function power(x: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return x.length ? s / x.length : 0;
}

/** x plus white noise at the given SNR (dB, relative to x's mean power), in place. */
export function addNoise(x: Float64Array, rnd: () => number, snrDb: number): Float64Array {
  const sigma = Math.sqrt(power(x) / 10 ** (snrDb / 10));
  for (let i = 0; i < x.length; i++) x[i] += sigma * gaussian(rnd);
  return x;
}

/** The lab's shared input: two tones, a chirp and a little noise, seeded. */
export function labSignal(n: number, fs: number, seed: number): Float64Array {
  const rnd = mulberry32(seed);
  const f1 = fs * (0.05 + 0.1 * rnd());
  const f2 = fs * (0.25 + 0.1 * rnd());
  const x = tones(n, fs, [{ f: f1, a: 0.6 }, { f: f2, a: 0.3, ph: rnd() * 6 }]);
  const c = chirp(n, fs, fs * 0.02, fs * 0.45, 0.4);
  for (let i = 0; i < n; i++) x[i] += c[i];
  return addNoise(x, rnd, 30);
}

export { mulberry32 };
