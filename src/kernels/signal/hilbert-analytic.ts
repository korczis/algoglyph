import { mulberry32 } from '../../engines/signal/input';
import { chartPoints, MUL, type Meter, type SignalKernel, type View } from '../../engines/signal/trace';
import { fft, nextPow2 } from './_fft';

const FS = 8000;
const LEN = 4096;

/**
 * The analytic signal z = x + i·H{x}: transform, keep DC and Nyquist, double the positive
 * frequencies, drop the negative ones, transform back. Returns [Re z, Im z] of length x.length.
 */
export function analytic(x: ArrayLike<number>, meter?: Meter): [Float64Array, Float64Array] {
  const n = nextPow2(x.length);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < x.length; i++) re[i] = x[i];
  fft(re, im, meter);
  for (let k = 1; k < n / 2; k++) { re[k] *= 2; im[k] *= 2; }
  for (let k = n / 2 + 1; k < n; k++) { re[k] = 0; im[k] = 0; }
  meter?.add(MUL, n);
  fft(re, im, meter, true);
  return [re.slice(0, x.length), im.slice(0, x.length)];
}

/** Instantaneous frequency (Hz) from the phase step arg(z[i+1]·conj z[i]). */
export function instFreq(re: Float64Array, im: Float64Array, fs: number, meter?: Meter): Float64Array {
  const f = new Float64Array(re.length);
  for (let i = 0; i + 1 < re.length; i++) {
    const a = re[i + 1] * re[i] + im[i + 1] * im[i];
    const b = im[i + 1] * re[i] - re[i + 1] * im[i];
    f[i] = (Math.atan2(b, a) * fs) / (2 * Math.PI);
  }
  f[re.length - 1] = f[re.length - 2];
  meter?.add(MUL, 4 * re.length);
  return f;
}

// An amplitude- and frequency-modulated carrier; the analytic signal recovers both modulations,
// and its phase portrait is the carrier's rotating phasor.
export const kernel: SignalKernel = {
  rate: 10,
  params: [
    { kind: 'range', key: 'fc', label: 'Carrier (Hz)', min: 400, max: 2400, step: 10, value: 600 },
    { kind: 'range', key: 'depth', label: 'AM depth', min: 0, max: 0.95, step: 0.05, value: 0.6 },
    { kind: 'range', key: 'dev', label: 'FM deviation (Hz)', min: 0, max: 200, step: 10, value: 120 },
  ],
  run(params, seed, meter): View[] {
    const rnd = mulberry32(seed);
    // every frequency a whole number of cycles in the record, so the FFT sees a periodic signal
    // and the analytic signal has no wrap-around error at the ends
    const df = FS / LEN;
    const fc = Math.round(Number(params.fc) / df) * df;
    const m = Number(params.depth);
    const dev = Number(params.dev);
    const fa = (2 + Math.floor(rnd() * 4)) * df;
    const fm = (1 + Math.floor(rnd() * 2)) * df;
    const ph = rnd() * 2 * Math.PI;
    const env = new Float64Array(LEN);
    const truthF = new Float64Array(LEN);
    const x = new Float64Array(LEN);
    for (let i = 0; i < LEN; i++) {
      const t = i / FS;
      env[i] = 1 + m * Math.cos(2 * Math.PI * fa * t);
      truthF[i] = fc + dev * Math.cos(2 * Math.PI * fm * t);
      x[i] = env[i] * Math.cos(2 * Math.PI * fc * t + (dev / fm) * Math.sin(2 * Math.PI * fm * t) + ph);
    }
    const [re, im] = analytic(x, meter);
    const mag = Float64Array.from(re, (v, i) => Math.hypot(v, im[i]));
    meter.add(MUL, 2 * LEN);
    const f = instFreq(re, im, FS, meter);
    const lo = 0; const hi = LEN;
    let envErr = 0; const fErr: number[] = [];
    for (let i = lo; i < hi; i++) { envErr += (mag[i] - env[i]) ** 2; fErr.push(Math.abs(f[i] - truthF[i])); }
    envErr = Math.sqrt(envErr / (hi - lo));
    fErr.sort((a, b) => a - b);
    const counts = meter.snapshot();
    const views: View[] = [];
    const steps = 64;
    const trail = Math.round((2 * FS) / fc); // two carrier cycles
    for (let s = 1; s <= steps; s++) {
      const upto = Math.floor((s / steps) * LEN);
      const c = upto - 1;
      const pts: number[] = [];
      for (let i = Math.max(0, c - trail); i <= c; i++) pts.push(re[i], im[i]);
      const r = 1 + m + 0.1;
      views.push({
        layout: [[0], [1, 2]],
        panels: [
          { kind: 'wave', title: 'x(t), the measured envelope |z| and the true one', upto, series: [
            { name: 'x', y: x, tone: -1, alpha: 120 }, { name: 'true envelope', y: env, tone: 0.3, alpha: 160 },
            { name: '|z| measured', y: mag, tone: 0.8 }] },
          { kind: 'wave', title: 'Instantaneous frequency (Hz)', upto, range: [fc - dev - 150, fc + dev + 150], series: [
            { name: 'true', y: truthF, tone: 0.3, alpha: 160 }, { name: 'measured', y: f, tone: 0.8 }] },
          { kind: 'xy', title: 'Phase portrait: Re z against Im z', range: [-r, r, -r, r], equal: true, xLabel: 'Re z', yLabel: 'Im z',
            lines: [{ pts, tone: 0.6, weight: 1.2 }],
            arrows: [{ x0: 0, y0: 0, x1: re[c], y1: im[c], tone: 0.85 }] },
        ],
        stats: [
          { label: 'Time', value: `${(c / FS).toFixed(3)} s` },
          { label: 'Carrier, AM and FM rates', value: `${fc.toFixed(2)}, ${fa.toFixed(2)} and ${fm.toFixed(2)} Hz` },
          { label: 'Envelope now: measured vs true', value: `${mag[c].toFixed(3)} vs ${env[c].toFixed(3)}` },
          { label: 'Frequency now: measured vs true', value: `${f[c].toFixed(1)} vs ${truthF[c].toFixed(1)} Hz` },
          { label: 'Envelope RMS error', value: envErr.toExponential(2) },
          { label: 'Median frequency error', value: `${fErr[fErr.length >> 1].toFixed(2)} Hz` },
        ],
        counts,
        chart: { title: 'Instantaneous frequency', x: { label: 'time (s)' }, y: { label: 'frequency (Hz)' }, series: [
          { name: 'measured', points: chartPoints(f, (i) => i / FS, 300, 0, upto) },
          { name: 'true', points: chartPoints(truthF, (i) => i / FS, 300, 0, upto) }] },
      });
    }
    return views;
  },
  lab(x, _fs, meter) {
    const [re, im] = analytic(x, meter);
    const mag = Float64Array.from(re, (v, i) => Math.hypot(v, im[i]));
    meter.add(MUL, 2 * re.length);
    return { kind: 'wave', title: 'envelope |z|', series: [{ name: 'x', y: x, tone: -1, alpha: 90 }, { name: '|z|', y: mag, tone: 0.8 }] };
  },
};
