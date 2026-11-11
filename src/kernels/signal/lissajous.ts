import { gaussian } from '../../core/random';
import { mulberry32 } from '../../engines/signal/input';
import { MUL, type Meter, type SignalKernel, type View } from '../../engines/signal/trace';
import { argmax, fft } from './_fft';

const N = 1024; // samples over one full period of the figure

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const wrap = (x: number) => x - 2 * Math.PI * Math.floor((x + Math.PI) / (2 * Math.PI));

/** x = sin(a·2πt + δ), y = sin(b·2πt) over t ∈ [0, 1), plus optional noise. */
export function figure(a: number, b: number, delta: number, noise = 0, rnd?: () => number): [Float64Array, Float64Array] {
  const x = new Float64Array(N); const y = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / N;
    x[i] = Math.sin(2 * Math.PI * a * t + delta) + (rnd ? noise * gaussian(rnd) : 0);
    y[i] = Math.sin(2 * Math.PI * b * t) + (rnd ? noise * gaussian(rnd) : 0);
  }
  return [x, y];
}

/**
 * Read the figure back from its samples: each axis's frequency is its spectrum's peak bin, and
 * δ is x's phase at its bin less a/b times y's phase at its bin (both sines, so +π/2 each).
 */
export function read(x: Float64Array, y: Float64Array, meter?: Meter): { a: number; b: number; delta: number } {
  const spec = (v: Float64Array) => {
    const re = Float64Array.from(v); const im = new Float64Array(v.length);
    fft(re, im, meter);
    const mag = Float64Array.from({ length: v.length / 2 }, (_, k) => Math.hypot(re[k], im[k]));
    meter?.add(MUL, v.length);
    const k = argmax(mag, 1);
    return { k, ph: Math.atan2(im[k], re[k]) };
  };
  const sx = spec(x); const sy = spec(y);
  const delta = wrap(sx.ph + Math.PI / 2 - (sx.k / sy.k) * (sy.ph + Math.PI / 2));
  return { a: sx.k, b: sy.k, delta };
}

// Two sinusoids on two axes, as on an oscilloscope in X-Y mode; the figure's frequency ratio and
// phase are read back from the samples, and a slow phase drift makes the figure turn.
export const kernel: SignalKernel = {
  rate: 15,
  aspect: 16 / 9,
  params: [
    { kind: 'range', key: 'a', label: 'x frequency a', min: 1, max: 9, step: 1, value: 3 },
    { kind: 'range', key: 'b', label: 'y frequency b', min: 1, max: 9, step: 1, value: 2 },
    { kind: 'range', key: 'delta', label: 'Phase δ (degrees)', min: 0, max: 180, step: 1, value: 30 },
    { kind: 'range', key: 'drift', label: 'Phase drift (degrees per view)', min: 0, max: 10, step: 0.5, value: 2 },
    { kind: 'range', key: 'noise', label: 'Noise', min: 0, max: 0.2, step: 0.005, value: 0 },
  ],
  run(params, seed, meter): View[] {
    const rnd = mulberry32(seed);
    const a = Number(params.a); const b = Number(params.b);
    const d0 = (Number(params.delta) * Math.PI) / 180;
    const drift = (Number(params.drift) * Math.PI) / 180;
    const noise = Number(params.noise);
    const g = gcd(a, b);
    const views: View[] = [];
    const history: [number, number][] = []; const truthH: [number, number][] = [];
    const steps = 90;
    for (let v = 0; v < steps; v++) {
      const delta = d0 + v * drift;
      const [x, y] = figure(a, b, delta, noise, rnd);
      meter.add('Samples', 2 * N);
      const got = read(x, y, meter);
      const gg = gcd(got.a, got.b);
      const deg = (r: number) => (((r * 180) / Math.PI) % 360 + 360) % 360;
      history.push([v, deg(got.delta)]);
      truthH.push([v, deg(wrap(delta))]);
      const pts: number[] = [];
      const reveal = Math.min(N, Math.round(((v + 1) / 12) * N));
      for (let i = 0; i < reveal; i++) pts.push(x[i], y[i]);
      if (reveal === N) pts.push(x[0], y[0]);
      const head = (reveal - 1) % N;
      const stats = [
        { label: 'Ratio set', value: `${a / g} : ${b / g}` },
        { label: 'Ratio read from the spectra', value: `${got.a / gg} : ${got.b / gg}` },
        { label: 'Phase δ now: set vs read', value: `${deg(wrap(delta)).toFixed(2)}° vs ${deg(got.delta).toFixed(2)}°` },
      ];
      if (a === b) {
        // the ellipse reading: where x crosses zero, |y| = |sin δ| of the peak
        let sum = 0; let c = 0;
        for (let i = 0; i < N; i++) {
          const j = (i + 1) % N;
          if (x[i] <= 0 && x[j] > 0) { const f = -x[i] / (x[j] - x[i]); sum += Math.abs(y[i] + f * (y[j] - y[i])); c++; }
        }
        if (c) stats.push({ label: 'Ellipse reading |sin δ| at x = 0', value: `${(sum / c).toFixed(4)} (set ${Math.abs(Math.sin(delta)).toFixed(4)})` });
      }
      views.push({
        layout: [[0, 1]],
        panels: [
          { kind: 'xy', title: `x = sin(${a}·ωt + δ), y = sin(${b}·ωt)`, range: [-1.3, 1.3, -1.3, 1.3], equal: true,
            lines: [{ pts, tone: 0.75, weight: 1.6 }], dots: [{ x: x[head], y: y[head], tone: -1, r: 4 }] },
          { kind: 'lanes', title: 'The two channels over one period', lanes: [{ name: 'x(t)', y: x, tone: 0.75 }, { name: 'y(t)', y: y, tone: 0.3 }] },
        ],
        stats,
        counts: meter.snapshot(),
        chart: { title: 'Phase: set and read back', x: { label: 'view' }, y: { label: 'δ (degrees)' }, series: [
          { name: 'read from samples', points: history.slice() }, { name: 'set', points: truthH.slice() }] },
      });
    }
    return views;
  },
};
