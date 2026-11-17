// A plucked string on the shared S2 stencil (src/plates/_shared/wave2d/leapfrog.ts): a line of
// L cells fixed at both ends, released from rest in a triangle with its apex at the pluck point.
// A pickup records the displacement at one point for ten periods of the fundamental. The
// spectrum of that record (Hann window, a DFT over its first harmonics' bins, peaks refined by a
// parabola through the log magnitudes) gives the modes' frequencies and amplitudes. They are
// compared with the string's closed forms: f_n = n c / 2L, and for a pluck at p and a pickup at q
// the amplitude ratio |sin(nπp) sin(nπq)| / (n² |sin(πp) sin(πq)|). Below C² = 1 they are compared
// with the scheme's own modes, sin(ω/2) = C sin(k/2).
import type { Chart, SelectParam } from '../../core/plate';
import { drain, fmt, int, type Layer, type NumericKernel, type NumericRun, type RunInput, type XY } from '../../engines/numeric/trace';
import { leapfrog1d, leapfrogOmega } from '../../plates/_shared/wave2d/leapfrog';

/** Cells along the string: divisible by 2, 3, 4, 5 and 6, so every pluck offered lands on a cell. */
export const L = 240;
/** Harmonics analysed. */
export const HARMONICS = 12;
/** Periods of the fundamental the pickup records. */
export const PERIODS = 10;
/** Snapshots of the string the run replays, over the first two periods. */
export const SNAPSHOTS = 160;
/** The pickup, as a fraction of the length: no low harmonic has a node there. */
export const PICKUP = 0.13;

export interface StringRun {
  /** The pickup's record, one sample a step. */
  record: Float64Array;
  /** Snapshots of the whole string, over two periods. */
  frames: Float64Array[];
  /** Steps between snapshots. */
  every: number;
}

/** The triangle a pluck at fraction p leaves, unit height, zero at both ends. */
export function pluckShape(p: number, n = L): Float64Array {
  const at = Math.round(p * n);
  const u = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) u[i] = i <= at ? i / at : (n - i) / (n - at);
  return u;
}

/** The fundamental's period in steps on the scheme: 2π / ω(π/L). */
export const period = (c2: number, n = L) => (2 * Math.PI) / leapfrogOmega(Math.PI / n, c2);

/** Steps between yields of the resumable run: a few milliseconds of work each. */
const STEP_SLICE = 512;
const BIN_SLICE = 4;

/** Releases the string from rest and records the pickup for `steps` steps. */
export function pluck(c2: number, p: number, steps: number, n = L, snapshots = SNAPSHOTS): StringRun {
  return drain(pluckSliced(c2, p, steps, n, snapshots));
}

/** The same, resumable: it yields every STEP_SLICE steps. */
export function* pluckSliced(c2: number, p: number, steps: number, n = L, snapshots = SNAPSHOTS): Generator<void, StringRun, void> {
  let u: Float64Array = pluckShape(p, n);
  // released from rest: u⁻ = u + (C²/2)Δu, so that u(−1) = u(1)
  let prev: Float64Array = new Float64Array(n + 1);
  for (let i = 1; i < n; i++) prev[i] = u[i] + 0.5 * c2 * (u[i - 1] + u[i + 1] - 2 * u[i]);
  let nxt: Float64Array = new Float64Array(n + 1);
  const q = Math.round(PICKUP * n);
  const record = new Float64Array(steps);
  const every = Math.max(1, Math.round((2 * period(c2, n)) / snapshots));
  const frames: Float64Array[] = [];
  for (let t = 0; t < steps; t++) {
    record[t] = u[q];
    if (t % every === 0 && frames.length < snapshots) frames.push(u.slice());
    leapfrog1d(u, prev, nxt, n + 1, c2);
    [prev, u, nxt] = [u, nxt, prev];
    if ((t + 1) % STEP_SLICE === 0) yield;
  }
  return { record, frames, every };
}

/** |X(b)| of the Hann-windowed record at integer bins 0 … bins. */
export function spectrum(record: Float64Array, bins: number): Float64Array {
  return drain(spectrumSliced(record, bins));
}

/** The same, resumable: it yields every BIN_SLICE bins. */
export function* spectrumSliced(record: Float64Array, bins: number): Generator<void, Float64Array, void> {
  const T = record.length;
  const w = new Float64Array(T);
  for (let t = 0; t < T; t++) w[t] = record[t] * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / T));
  const out = new Float64Array(bins + 1);
  for (let b = 0; b <= bins; b++) {
    let re = 0; let im = 0;
    const d = (2 * Math.PI * b) / T;
    // the bin's phasor by recurrence: one complex multiplication a sample
    const cd = Math.cos(d); const sd = Math.sin(d);
    let c = 1; let s = 0;
    for (let t = 0; t < T; t++) {
      re += w[t] * c; im -= w[t] * s;
      const c1 = c * cd - s * sd; s = s * cd + c * sd; c = c1;
    }
    out[b] = Math.hypot(re, im);
    if ((b + 1) % BIN_SLICE === 0) yield;
  }
  return out;
}

/** The peak nearest the expected bin, refined by a parabola through the log magnitudes: [cycles per step, magnitude]. */
export function peakNear(mag: Float64Array, bin: number, T: number): [number, number] {
  let b = Math.max(1, Math.min(mag.length - 2, Math.round(bin)));
  for (let k = 0; k < 4; k++) {
    if (mag[b + 1] > mag[b] && b + 2 < mag.length) b++;
    else if (mag[b - 1] > mag[b] && b > 1) b--;
  }
  const a = Math.log(Math.max(mag[b - 1], 1e-300));
  const c = Math.log(Math.max(mag[b], 1e-300));
  const d = Math.log(Math.max(mag[b + 1], 1e-300));
  const den = a - 2 * c + d;
  const off = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - d)) / den)) : 0;
  return [(b + off) / T, mag[b]];
}

/**
 * The closed-form amplitude of harmonic n relative to the fundamental, for a pluck at p heard at
 * the pickup's cell. The triangle's second difference is a single spike at the pluck, so on a
 * string of L cells its mode n has the weight sin(nπp) / sin²(nπ/2L); the pickup at cell q hears it
 * with sin(nπq/L). As L grows, sin²(nπ/2L) / sin²(π/2L) tends to n², the continuous string's 1/n².
 */
export function amplitudeRatio(n: number, p: number, cells = L): number {
  const q = Math.round(PICKUP * cells) / cells;
  const s = (m: number) => Math.sin((m * Math.PI) / (2 * cells)) ** 2;
  return (Math.abs(Math.sin(n * Math.PI * p) * Math.sin(n * Math.PI * q)) * s(1))
    / (Math.abs(Math.sin(Math.PI * p) * Math.sin(Math.PI * q)) * s(n));
}

export interface Analysis { f: number[]; amp: number[]; scheme: number[]; T: number }

/** The run's modes: measured frequency and relative amplitude of each harmonic, and the scheme's. */
export function analyse(c2: number, p: number): Analysis & { run: StringRun } {
  return drain(analyseSliced(c2, p));
}

function* analyseSliced(c2: number, p: number): Generator<void, Analysis & { run: StringRun }, void> {
  const P = period(c2);
  const T = Math.round(PERIODS * P);
  const run = yield* pluckSliced(c2, p, T);
  const f1 = 1 / P;
  const mag = yield* spectrumSliced(run.record, Math.ceil((HARMONICS + 1) * f1 * T) + 2);
  const f: number[] = []; const amp: number[] = []; const scheme: number[] = [];
  for (let n = 1; n <= HARMONICS; n++) {
    const fn = leapfrogOmega((n * Math.PI) / L, c2) / (2 * Math.PI);
    scheme.push(fn);
    const [fm, m] = peakNear(mag, fn * T, T);
    f.push(fm); amp.push(m);
  }
  const a1 = amp[0];
  return { f, amp: amp.map((a) => a / a1), scheme, T, run };
}

export const c2Param = (): SelectParam => ({
  kind: 'select', key: 'c2', label: 'Courant number squared C²', value: '1', rebuild: true,
  options: [
    { value: '1', label: '1 (the scheme is exact on a line)' },
    { value: '0.5', label: '0.5' },
    { value: '0.25', label: '0.25' },
  ],
});

export const pluckParam = (): SelectParam => ({
  kind: 'select', key: 'pluck', label: 'Plucked at', value: '0.2', rebuild: true,
  options: [
    { value: '0.5', label: 'the middle, L/2' },
    { value: '0.333333', label: 'a third, L/3' },
    { value: '0.25', label: 'a quarter, L/4' },
    { value: '0.2', label: 'a fifth, L/5' },
  ],
});

const pick = (v: unknown, allowed: number[], fallback: number) => {
  const x = Number(v);
  return allowed.some((a) => Math.abs(a - x) < 1e-6) ? x : fallback;
};

export const kernel: NumericKernel = {
  params: [c2Param(), pluckParam()],
  thumb: 0.3,
  run(inp: RunInput): NumericRun { return drain(build(inp)); },
  build,
};

/** The run, in slices: the string, its spectrum, then the replay's steps. */
function* build({ params }: RunInput): Generator<void, NumericRun, void> {
  {
    const c2 = pick(params.c2, [1, 0.5, 0.25], 1);
    const p = pick(params.pluck, [0.5, 0.333333, 0.25, 0.2], 0.2);
    const { f, amp, scheme, T, run } = yield* analyseSliced(c2, p);
    const c = Math.sqrt(c2);
    const closed = (n: number) => (n * c) / (2 * L);
    const panels = [
      { title: `The string, plucked at ${fmt(p, 3)} L, over two periods`, x: [0, L] as [number, number], y: [-1.15, 1.15] as [number, number], axes: true, weight: 1.4 },
      { title: 'Harmonics heard at the pickup, relative to the fundamental', x: [0.4, HARMONICS + 0.6] as [number, number], y: [0, 1.08] as [number, number], weight: 1 },
    ];
    const bars: [number, number, number, number, number][] = amp.map((a, i) => [i + 1 - 0.3, 0, 0.6, Math.min(1, a), 0.75]);
    const expected: [number, number, number, number][] = amp.map((_, i) => {
      const e = Math.min(1, amplitudeRatio(i + 1, p));
      return [i + 1 - 0.38, e, i + 1 + 0.38, e];
    });
    const q = Math.round(PICKUP * L);
    const chart: Chart = {
      title: 'Mode frequencies, measured and in closed form (cycles per step)',
      x: { label: 'harmonic n' }, y: { label: 'frequency' },
      series: [
        { name: 'measured', points: f.map((v, i) => [i + 1, v] as XY) },
        { name: 'n c / 2L', points: f.map((_, i) => [i + 1, closed(i + 1)] as XY) },
        { name: 'the scheme, sin(ω/2) = C sin(k/2)', points: scheme.map((v, i) => [i + 1, v] as XY) },
      ],
    };
    const ratio = (n: number) => f[n - 1] / f[0];
    const missing = Math.round(1 / p);
    // every readout but the step's own is the same at every step: formatted once, shared
    const fixed = [
      { label: 'Fundamental, measured (cycles per step)', value: fmt(f[0], 8) },
      { label: 'Fundamental c / 2L, closed form', value: fmt(closed(1), 8) },
      { label: 'Fundamental of the scheme, ω(π/L) / 2π', value: fmt(scheme[0], 8) },
      { label: '7th harmonic over the fundamental, measured', value: fmt(ratio(7), 6) },
      { label: '7th over the fundamental, the scheme’s ω₇ / ω₁', value: fmt(scheme[6] / scheme[0], 6) },
      { label: '2nd harmonic’s amplitude over the fundamental’s, measured', value: fmt(amp[1], 6) },
      { label: '2nd harmonic’s amplitude, closed form for the plucked string of L cells', value: fmt(amplitudeRatio(2, p), 6) },
      { label: 'Missing harmonic’s amplitude over the fundamental’s', value: Math.abs(missing * p - 1) < 1e-4 ? (amp[missing - 1] === 0 ? '0' : amp[missing - 1].toExponential(2)) : 'no harmonic has a node at this pluck' },
      { label: 'Harmonics measured', value: int(HARMONICS) },
      { label: 'C², the Courant number squared', value: fmt(c2, 3) },
    ];
    const steps: NumericRun['steps'] = [];
    for (let k = 0; k < run.frames.length; k++) {
      const u = run.frames[k];
      const layers: Layer[] = [
        { kind: 'curve', pts: Array.from(u, (v, i) => [i, v] as XY), weight: 2.5, tone: 0.8 },
        { kind: 'points', pts: [[Math.round(p * L), 1], [q, u[q]]], size: 7 },
        { kind: 'text', x: q, y: -1.05, text: 'pickup', align: 'center' },
        { kind: 'rects', panel: 1, rects: bars },
        { kind: 'segments', panel: 1, segs: expected, weight: 2 },
      ];
      steps.push({
        layers,
        chart,
        stats: [
          { label: 'Step', value: `${int(k * run.every)} of ${int(T)} recorded` },
          ...fixed,
        ],
      });
      if ((k + 1) % 20 === 0) yield;
    }
    return { panels, steps };
  }
}
