import { str } from '../../core/plate';
import { chartPoints, MUL, type Meter, type SignalKernel, type View } from '../../engines/signal/trace';
import { fft } from './_fft';

const FS = 16000;
const IR = 16384;

export type Kind = 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'peaking';
export interface Biquad { b: [number, number, number]; a: [number, number, number] }

/** Second-order sections by the bilinear transform of the analogue prototypes, a0 = 1. */
export function design(kind: Kind, f0: number, q: number, gainDb: number, fs = FS): Biquad {
  const w = (2 * Math.PI * f0) / fs;
  const c = Math.cos(w);
  const al = Math.sin(w) / (2 * q);
  const A = 10 ** (gainDb / 40);
  let b: number[]; let a: number[];
  switch (kind) {
    case 'highpass': b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; a = [1 + al, -2 * c, 1 - al]; break;
    case 'bandpass': b = [al, 0, -al]; a = [1 + al, -2 * c, 1 - al]; break;
    case 'notch': b = [1, -2 * c, 1]; a = [1 + al, -2 * c, 1 - al]; break;
    case 'peaking': b = [1 + al * A, -2 * c, 1 - al * A]; a = [1 + al / A, -2 * c, 1 - al / A]; break;
    default: b = [(1 - c) / 2, 1 - c, (1 - c) / 2]; a = [1 + al, -2 * c, 1 - al];
  }
  return { b: [b[0] / a[0], b[1] / a[0], b[2] / a[0]], a: [1, a[1] / a[0], a[2] / a[0]] };
}

/** The difference equation y[n] = b0x[n] + b1x[n-1] + b2x[n-2] − a1y[n-1] − a2y[n-2]. */
export function filter(f: Biquad, x: ArrayLike<number>, meter?: Meter): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  for (let n = 0; n < x.length; n++) {
    const v = f.b[0] * x[n] + f.b[1] * x1 + f.b[2] * x2 - f.a[1] * y1 - f.a[2] * y2;
    x2 = x1; x1 = x[n]; y2 = y1; y1 = v; y[n] = v;
  }
  meter?.add(MUL, 5 * x.length);
  return y;
}

/** Roots of c0 z² + c1 z + c2. */
export function roots(c0: number, c1: number, c2: number): [number, number][] {
  if (Math.abs(c0) < 1e-15) return Math.abs(c1) < 1e-15 ? [] : [[-c2 / c1, 0]];
  const d = c1 * c1 - 4 * c0 * c2;
  if (d >= 0) return [[(-c1 + Math.sqrt(d)) / (2 * c0), 0], [(-c1 - Math.sqrt(d)) / (2 * c0), 0]];
  return [[-c1 / (2 * c0), Math.sqrt(-d) / (2 * c0)], [-c1 / (2 * c0), -Math.sqrt(-d) / (2 * c0)]];
}

/** |H| of the filter measured from its impulse response: bins 0..IR/2. */
export function measuredResponse(f: Biquad, meter?: Meter): { ir: Float64Array; mag: Float64Array } {
  const imp = new Float64Array(IR); imp[0] = 1;
  const ir = filter(f, imp, meter);
  const re = Float64Array.from(ir); const im = new Float64Array(IR);
  fft(re, im, meter);
  return { ir, mag: Float64Array.from({ length: IR / 2 + 1 }, (_, k) => Math.hypot(re[k], im[k])) };
}

const dB = (v: number) => 20 * Math.log10(Math.max(1e-9, v));

// Five classic sections; the poles and zeros are the roots of the denominator and numerator,
// and the response measured from the impulse response follows them across the z-plane.
export const kernel: SignalKernel = {
  rate: 10,
  params: [
    { kind: 'select', key: 'type', label: 'Filter', value: 'lowpass', options: [
      { value: 'lowpass', label: 'Low-pass' }, { value: 'highpass', label: 'High-pass' }, { value: 'bandpass', label: 'Band-pass' },
      { value: 'notch', label: 'Notch' }, { value: 'peaking', label: 'Peaking EQ' }] },
    { kind: 'range', key: 'f0', label: 'Corner or centre (Hz)', min: 50, max: 7000, step: 10, value: 1000 },
    { kind: 'range', key: 'q', label: 'Q', min: 0.3, max: 20, step: 0.1, value: 0.7 },
    { kind: 'range', key: 'gain', label: 'Peaking gain (dB)', min: -24, max: 24, step: 1, value: 9 },
  ],
  *run(params, _seed, meter): Generator<View | null> {
    const kind = str(params, 'type') as Kind;
    const f0 = Number(params.f0); const q = Number(params.q);
    const f = design(kind, f0, q, Number(params.gain));
    const poles = roots(1, f.a[1], f.a[2]);
    const zeros = roots(f.b[0], f.b[1], f.b[2]);
    const { ir, mag } = measuredResponse(f, meter);
    yield null;
    const df = FS / IR;
    // the response evaluated on the unit circle, H(e^{jω}) = B(e^{jω}) / A(e^{jω})
    const exact = Float64Array.from(mag, (_, k) => {
      const w = 2 * Math.PI * k / IR;
      const br = f.b[0] + f.b[1] * Math.cos(w) + f.b[2] * Math.cos(2 * w);
      const bi = -(f.b[1] * Math.sin(w) + f.b[2] * Math.sin(2 * w));
      const ar = 1 + f.a[1] * Math.cos(w) + f.a[2] * Math.cos(2 * w);
      const ai = -(f.a[1] * Math.sin(w) + f.a[2] * Math.sin(2 * w));
      return Math.hypot(br, bi) / Math.hypot(ar, ai);
    });
    let worst = 0;
    for (let k = 1; k < mag.length; k++) if (exact[k] > 1e-3) worst = Math.max(worst, Math.abs(dB(mag[k]) - dB(exact[k])));
    let pk = 1;
    for (let k = 1; k < mag.length; k++) if (mag[k] > mag[pk]) pk = k;
    // the −3 dB points around the passband, measured from the response
    const ref = kind === 'lowpass' ? mag[1] : kind === 'highpass' ? mag[mag.length - 1] : mag[pk];
    const cross: number[] = [];
    if (kind !== 'peaking' && kind !== 'notch') {
      for (let k = 1; k < mag.length; k++) {
        const a = dB(mag[k - 1] / ref) + 3.0103; const b = dB(mag[k] / ref) + 3.0103;
        if (a * b < 0) cross.push((k - 1 + a / (a - b)) * df);
      }
    }
    const radius = Math.max(...poles.map(([x, y]) => Math.hypot(x, y)));
    const angle = Math.abs(Math.atan2(poles[0][1], poles[0][0]));
    const magDb = Float64Array.from(mag, dB);
    const exactDb = Float64Array.from(exact, dB);
    const show = 256;
    const steps = 32;
    for (let s = 1; s <= steps; s++) {
      yield {
        layout: [[0, 1], [2]],
        panels: [
          { kind: 'plane', title: 'z-plane', poles, zeros },
          { kind: 'spectrum', title: '|H(e^{jω})|: from the impulse response, and evaluated', fmax: FS / 2, fmin: 20, logx: true, floor: -60, ceil: 30, series: [
            { name: 'H(z) evaluated', y: exactDb, tone: 0.25, alpha: 170 }, { name: 'measured', y: magDb, tone: 0.8 }],
          marks: [{ at: f0, label: 'f0' }, ...cross.map((c) => ({ at: c, label: '−3 dB' }))] },
          { kind: 'wave', title: `Impulse response, first ${show} samples`, upto: Math.ceil((s / steps) * show), series: [{ name: 'h[n]', y: ir.subarray(0, show), stems: true, tone: 0.7 }] },
        ],
        stats: [
          { label: 'b0, b1, b2', value: f.b.map((v) => v.toFixed(5)).join(', ') },
          { label: 'a1, a2', value: `${f.a[1].toFixed(5)}, ${f.a[2].toFixed(5)}` },
          { label: 'Pole radius (stable below 1)', value: radius.toFixed(5) },
          { label: 'Pole angle as a frequency', value: `${(angle * FS / (2 * Math.PI)).toFixed(1)} Hz` },
          { label: '−3 dB points (measured)', value: cross.length ? cross.map((c) => `${c.toFixed(1)} Hz`).join(', ') : 'none' },
          { label: 'Peak gain (measured)', value: `${dB(mag[pk]).toFixed(2)} dB at ${(pk * df).toFixed(1)} Hz` },
          { label: 'Measured against evaluated, worst', value: `${worst.toExponential(2)} dB` },
        ],
        counts: meter.snapshot(),
        chart: { title: 'Magnitude response', x: { label: 'frequency (Hz)', log: true }, y: { label: 'gain (dB)' }, series: [
          { name: 'measured', points: chartPoints(magDb, (k) => k * df, 400, 1) },
          { name: 'H(z) evaluated', points: chartPoints(exactDb, (k) => k * df, 400, 1) }] },
      };
    }
  },
};
