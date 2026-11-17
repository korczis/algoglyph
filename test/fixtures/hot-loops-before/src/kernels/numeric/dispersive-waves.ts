// Frozen for test/hot-loops: src/kernels/numeric/dispersive-waves.ts as it was before fix/hot-loop-imports, verbatim except that
// imports outside the frozen files point at today's modules under src/.
// Dispersion on the leapfrog line (Feynman Vol. I ch. 48): the S2 stencil of
// src/plates/_shared/wave2d/leapfrog.ts on a line of cells, whose own dispersion relation
// sin(ω/2) = C sin(k/2) is the physics. Below C² = 1 short waves travel slower than long ones, so a
// wave packet's envelope moves at the group velocity dω/dk while its crests move at the phase
// velocity ω/k; at C² = 1 the scheme is exact and the two are equal. Two close wavenumbers beat,
// and the beat envelope moves at Δω/Δk. Every velocity is measured from the field the stencil
// computes (the packet centre Σx u²/Σu², the carrier's phase, the beat nodes at two probes) and
// compared with the closed-form dispersion, never with another measurement.
import type { Chart, SelectParam } from '../../../../../../src/core/plate';
import { fitLine, fmt, int, type Layer, type NumericKernel, type NumericRun, type Panel, type RunInput, type Step, type XY, drain } from '../../../../../../src/engines/numeric/trace';
import {
  leapfrog1d, leapfrogGroupVelocity, leapfrogOmega, leapfrogPhaseVelocity,
} from '../../plates/_shared/wave2d/leapfrog';

/** One step of a line stencil, the shape of leapfrog1d (a mutated one is passed by the tests). */
export type Stencil = (u: Float64Array, prev: Float64Array, nxt: Float64Array, n: number, c2: number) => void;

export type Experiment = 'packet' | 'beats';

/** Carrier wavenumbers offered, in radians per cell (wavelengths of about 16, 8, 4 and 2.6 cells). */
export const K0S = ['0.4', '0.8', '1.6', '2.4'];
/** Courant numbers squared offered; 1 is the dispersion-free line. */
export const C2S = ['0.25', '0.5', '1'];

/** Time steps of a run, and the steps between two snapshots the plate replays. */
export const STEPS = 480;
export const EVERY = 4;

/** The packet: a Gaussian of rms width `sigma` cells about `x0` on a line of `n` cells. */
export const PACKET = { n: 800, x0: 150, sigma: 24 };
/**
 * The beats: two carriers k₀ ∓ δ under one broad Gaussian window, and two probes `gap` cells
 * apart where the envelope is read by demodulating at k₀ over a window of rms `window` cells.
 */
export const BEATS = { n: 1600, x0: 500, sigma: 160, delta: 0.05, probe: 700, gap: 30, window: 6 };

export interface Setup { experiment: Experiment; k0: number; c2: number }

export function setupOf(params: Record<string, unknown>): Setup {
  const experiment: Experiment = params.experiment === 'beats' ? 'beats' : 'packet';
  const k0 = Number(params.k0);
  const c2 = Number(params.c2);
  return {
    experiment,
    k0: K0S.includes(String(params.k0)) ? k0 : 1.6,
    c2: C2S.includes(String(params.c2)) ? c2 : 0.5,
  };
}

/** The carriers of an experiment: one at k₀, or two at k₀ ∓ δ. */
export const carriers = (s: Setup): number[] =>
  (s.experiment === 'beats' ? [s.k0 - BEATS.delta, s.k0 + BEATS.delta] : [s.k0]);

/**
 * The line at t = 0 and at t = −1: each carrier cos(k(x − x₀)) under a Gaussian envelope, and one
 * step earlier the same with its phase advanced by ω(k) and its envelope moved back by v_g(k₀),
 * so the wave sets off to the right.
 */
export function initial(s: Setup): { u: Float64Array; prev: Float64Array; n: number } {
  const g = s.experiment === 'beats' ? BEATS : PACKET;
  const u = new Float64Array(g.n);
  const prev = new Float64Array(g.n);
  const vg = leapfrogGroupVelocity(s.k0, s.c2);
  const ks = carriers(s);
  const ws = ks.map((k) => leapfrogOmega(k, s.c2));
  for (let x = 1; x < g.n - 1; x++) {
    const d = x - g.x0;
    const e0 = Math.exp(-(d * d) / (2 * g.sigma * g.sigma));
    const e1 = Math.exp(-((d + vg) * (d + vg)) / (2 * g.sigma * g.sigma));
    let a = 0; let b = 0;
    ks.forEach((k, i) => { a += Math.cos(k * d); b += Math.cos(k * d + ws[i]); });
    u[x] = e0 * a;
    prev[x] = e1 * b;
  }
  return { u, prev, n: g.n };
}

/** Local maxima of u above `floor`, refined to a fraction of a cell by a parabola. */
function crests(u: Float64Array, floor: number): number[] {
  const out: number[] = [];
  for (let i = 1; i < u.length - 1; i++) {
    if (u[i] > floor && u[i] >= u[i - 1] && u[i] > u[i + 1]) {
      const den = u[i - 1] - 2 * u[i] + u[i + 1];
      out.push(den < 0 ? i + (0.5 * (u[i - 1] - u[i + 1])) / den : i);
    }
  }
  return out;
}

/** Interior local minima of a series below `frac` of its maximum, refined by a parabola. */
export function minima(y: number[], frac = 0.25): number[] {
  let hi = 0;
  for (const v of y) if (v > hi) hi = v;
  const out: number[] = [];
  for (let i = 1; i < y.length - 1; i++) {
    if (y[i] < frac * hi && y[i] <= y[i - 1] && y[i] < y[i + 1]) {
      const den = y[i - 1] - 2 * y[i] + y[i + 1];
      out.push(den > 0 ? i + (0.5 * (y[i - 1] - y[i + 1])) / den : i);
    }
  }
  return out;
}

/** The demodulation weights at k₀: a Gaussian window of rms w cells, as cos and sin tables. */
function demodulator(k0: number, w: number): { half: number; c: number[]; s: number[]; norm: number } {
  const half = Math.ceil(3 * w);
  const c: number[] = []; const s: number[] = [];
  let sum = 0;
  for (let j = -half; j <= half; j++) {
    const g = Math.exp(-(j * j) / (2 * w * w));
    sum += g;
    c.push(g * Math.cos(k0 * j));
    s.push(-g * Math.sin(k0 * j));
  }
  // a unit carrier cos(k₀x) demodulates to Σg/2: the envelope is 2|z|/Σg
  return { half, c, s, norm: 2 / sum };
}

/** The envelope at cell x: the field demodulated at k₀ about x, scaled so a unit carrier reads 1. */
function envelopeAt(u: Float64Array, x: number, d: ReturnType<typeof demodulator>): number {
  let re = 0; let im = 0;
  for (let j = -d.half; j <= d.half; j++) {
    const v = u[x + j] ?? 0;
    re += v * d.c[j + d.half];
    im += v * d.s[j + d.half];
  }
  return d.norm * Math.hypot(re, im);
}

/** What a run measures, step by step; the kernel's readouts and the tests read the same. */
export interface Measured {
  /** Packet centre Σx u²/Σu² at every time step. */
  centre: number[];
  /** rms width about the centre at every time step. */
  width: number[];
  /** The carrier's phase at k₀ (the line's Fourier transform there), unwrapped, at every time step. */
  phase: number[];
  /** The envelope² at each probe at every time step (beats). */
  probes: [number[], number[]];
}

/** The slope of y against t = 0, 1, 2, … by least squares over the first m + 1 values. */
export const slopeUpTo = (y: number[], m: number): number =>
  (m < 1 ? NaN : fitLine(y.slice(0, m + 1).map((v, t) => [t, v] as XY))[0]);

/** Group velocity measured as the slope of the packet centre against time, up to step m. */
export const measuredGroupVelocity = (m: Measured, upTo = m.centre.length - 1) => slopeUpTo(m.centre, upTo);
/** Frequency measured as minus the slope of the carrier's unwrapped phase, up to step m. */
export const measuredOmega = (m: Measured, upTo = m.phase.length - 1) => -slopeUpTo(m.phase, upTo);

/** Beat period at the first probe: the mean spacing of the envelope's nodes. NaN below two nodes. */
export function beatPeriod(nodes: number[]): number {
  return nodes.length < 2 ? NaN : (nodes[nodes.length - 1] - nodes[0]) / (nodes.length - 1);
}

/** Envelope speed between the probes: the gap over the mean lag from a node at one to the next at the other. */
export function envelopeSpeed(a: number[], b: number[], gap: number): number {
  const lags: number[] = [];
  for (const t of a) {
    const next = b.find((s) => s > t);
    if (next !== undefined) lags.push(next - t);
  }
  return lags.length ? gap / (lags.reduce((x, y) => x + y, 0) / lags.length) : NaN;
}

/**
 * The run: STEPS steps of the stencil from `initial`, measured after every step, the field kept
 * every EVERY steps. A generator that yields after each kept snapshot.
 */
export function* simulate(s: Setup, stencil: Stencil = leapfrog1d): Generator<void, { m: Measured; frames: Float64Array[]; n: number }, void> {
  const { u: u0, prev: p0, n } = initial(s);
  let u: Float64Array = u0; let prev: Float64Array = p0; let nxt: Float64Array = new Float64Array(n);
  const ck: number[] = []; const sk: number[] = [];
  const x0 = s.experiment === 'beats' ? BEATS.x0 : PACKET.x0;
  for (let x = 0; x < n; x++) { ck.push(Math.cos(s.k0 * (x - x0))); sk.push(Math.sin(s.k0 * (x - x0))); }
  const dem = demodulator(s.k0, BEATS.window);
  const m: Measured = { centre: [], width: [], phase: [], probes: [[], []] };
  const frames: Float64Array[] = [];
  let unwrap = 0; let last = NaN;
  const measure = () => {
    let e = 0; let xe = 0; let xxe = 0; let re = 0; let im = 0;
    for (let x = 0; x < n; x++) {
      const v = u[x]; const w = v * v;
      e += w; xe += x * w; xxe += x * x * w;
      re += v * ck[x]; im -= v * sk[x];
    }
    const c = xe / e;
    m.centre.push(c);
    m.width.push(Math.sqrt(Math.max(0, xxe / e - c * c)));
    const ph = Math.atan2(im, re);
    if (Number.isFinite(last)) {
      let d = ph - last;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d <= -Math.PI) d += 2 * Math.PI;
      unwrap += d;
    } else unwrap = ph;
    last = ph;
    m.phase.push(unwrap);
    if (s.experiment === 'beats') {
      m.probes[0].push(envelopeAt(u, BEATS.probe, dem) ** 2);
      m.probes[1].push(envelopeAt(u, BEATS.probe + BEATS.gap, dem) ** 2);
    }
  };
  measure();
  frames.push(u.slice());
  for (let t = 1; t <= STEPS; t++) {
    stencil(u, prev, nxt, n, s.c2);
    const old = prev; prev = u; u = nxt; nxt = old;
    measure();
    if (t % EVERY === 0) { frames.push(u.slice()); yield; }
  }
  return { m, frames, n };
}

/** What the closed-form dispersion predicts for a setup: the oracle every measurement meets. */
export function predicted(s: Setup) {
  const [k1, k2] = [s.k0 - BEATS.delta, s.k0 + BEATS.delta];
  const dw = leapfrogOmega(k2, s.c2) - leapfrogOmega(k1, s.c2);
  return {
    omega: leapfrogOmega(s.k0, s.c2),
    vg: leapfrogGroupVelocity(s.k0, s.c2),
    vp: leapfrogPhaseVelocity(s.k0, s.c2),
    beatPeriod: (2 * Math.PI) / Math.abs(dw),
    envelopeSpeed: dw / (k2 - k1),
  };
}

const select = (key: string, label: string, value: string, options: { value: string; label: string }[]): SelectParam =>
  ({ kind: 'select', key, label, value, rebuild: true, options });

// fmt's output with one formatter made once: fmt calls toLocaleString, which builds an
// Intl.NumberFormat on every call (about 60 µs here), and a run formats its changing readouts at
// every one of its snapshots (src/core/format.ts says the same of counts).
const EN = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });
function num(v: number, digits = 6): string {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 1e-3 || a >= 1e7) return v.toExponential(2);
  return EN.format(Number(v.toPrecision(digits)));
}

const show = (v: number, digits = 6, unit = '') => (Number.isFinite(v) ? `${num(v, digits)}${unit}` : 'needs more of the run');

/** Least-squares slopes of y against t = 0 … m for every m, from running sums: O(1) each. */
export function runningSlopes(y: number[]): number[] {
  let st = 0; let sy = 0; let stt = 0; let sty = 0;
  return y.map((v, t) => {
    st += t; sy += v; stt += t * t; sty += t * v;
    const k = t + 1;
    const den = k * stt - st * st;
    return t < 1 || den === 0 ? NaN : (k * sty - st * sy) / den;
  });
}

/** The dispersion of the scheme, which does not change during a run: ω(k), v_g(k), v_p(k), ω = Ck. */
function dispersionSeries(c2: number): Chart['series'] {
  const c = Math.sqrt(c2);
  const ks = Array.from({ length: 64 }, (_, i) => (Math.PI * (i + 1)) / 64);
  return [
    { name: 'ω(k), scheme: sin(ω/2) = C sin(k/2)', points: ks.map((k) => [k, leapfrogOmega(k, c2)] as XY) },
    { name: 'ω = Ck, continuum', points: ks.map((k) => [k, c * k] as XY) },
    { name: 'group velocity dω/dk', points: ks.map((k) => [k, leapfrogGroupVelocity(k, c2)] as XY) },
    { name: 'phase velocity ω/k', points: ks.map((k) => [k, leapfrogPhaseVelocity(k, c2)] as XY) },
  ];
}

/** The cells a snapshot's wave occupies: from the first to the last cell above 10⁻⁴ of its peak. */
function support(u: Float64Array): [number, number, number] {
  let peak = 0;
  for (let x = 0; x < u.length; x++) { const a = Math.abs(u[x]); if (a > peak) peak = a; }
  const floor = 1e-4 * peak;
  let lo = 0; let hi = u.length - 1;
  while (lo < hi && Math.abs(u[lo]) <= floor) lo++;
  while (hi > lo && Math.abs(u[hi]) <= floor) hi--;
  return [lo, hi, peak];
}

export function* build(inp: RunInput): Generator<void, NumericRun, void> {
  const s = setupOf(inp.params);
  const { m, frames, n } = yield* simulate(s);
  const pred = predicted(s);
  const beats = s.experiment === 'beats';
  const amp = beats ? 2.4 : 1.2;
  const x0 = beats ? BEATS.x0 : PACKET.x0;
  const panels: Panel[] = [
    { title: beats ? 'The line u(x), two carriers k₀ ∓ δ beating' : 'The line u(x), a packet at k₀', x: [0, n - 1], y: [-amp, amp], axes: true, weight: 2 },
    beats
      ? { title: 'At the probes: the envelope against time', x: [0, STEPS], y: [0, amp], axes: true, weight: 1 }
      : { title: 'Centre and crests against time', x: [0, STEPS], y: [0, n - 1], axes: true, weight: 1 },
  ];
  const dem = demodulator(s.k0, BEATS.window);
  const vgAt = runningSlopes(m.centre);
  const wAt = runningSlopes(m.phase).map((v) => -v);
  const nodesA = minima(m.probes[0]);
  const nodesB = minima(m.probes[1]);
  // every mark that only grows is one array, revealed a snapshot at a time by its `n`
  const crestPts: XY[] = [];
  const centrePts: XY[] = m.centre.map((c, t) => [t, c] as XY);
  const probeA: XY[] = m.probes[0].map((v, t) => [t, Math.sqrt(v)] as XY);
  const probeB: XY[] = m.probes[1].map((v, t) => [t, Math.sqrt(v)] as XY);
  const nodeA: XY[] = nodesA.map((t) => [t, 0] as XY);
  const nodeB: XY[] = nodesB.map((t) => [t, 0] as XY);
  const probeSegs: [number, number, number, number][] = [[BEATS.probe, -amp, BEATS.probe, amp], [BEATS.probe + BEATS.gap, -amp, BEATS.probe + BEATS.gap, amp]];
  const vgLine: Layer = { kind: 'segments', panel: 1, segs: [[0, x0, STEPS, x0 + pred.vg * STEPS]], weight: 1, tone: 0.2, alpha: 0.5 };
  const vpLine: Layer = { kind: 'segments', panel: 1, segs: [[0, x0, STEPS, x0 + pred.vp * STEPS]], weight: 1, tone: 0.8, alpha: 0.5 };
  const series = dispersionSeries(s.c2);
  const chartTitle = `Dispersion of the leapfrog line, C² = ${fmt(s.c2)}`;
  const chartAxes = { x: { label: 'wavenumber k, rad/cell' }, y: { label: 'ω (rad/step), velocity (cells/step)' } };
  // the readouts that do not change during the run, formatted once and shared by every step
  const fixed = [
    { label: 'Experiment', value: beats ? `beats, k₀ ∓ δ with δ = ${BEATS.delta} rad/cell` : `a Gaussian packet of rms width ${PACKET.sigma} cells` },
    { label: 'Courant number squared C²', value: `${fmt(s.c2)} (continuum speed C = ${fmt(Math.sqrt(s.c2), 6)} cells/step)` },
    { label: 'Carrier wavenumber k₀', value: `${fmt(s.k0)} rad/cell, wavelength ${fmt((2 * Math.PI) / s.k0, 4)} cells` },
    { label: 'Frequency ω(k₀) of the scheme, sin(ω/2) = C sin(k/2)', value: show(pred.omega, 6, ' rad/step') },
    { label: 'Group velocity dω/dk of the scheme', value: show(pred.vg, 6, ' cells/step') },
    { label: 'Phase velocity ω/k of the scheme', value: show(pred.vp, 6, ' cells/step') },
    ...(beats ? [
      { label: 'Probes at cells', value: `${BEATS.probe} and ${BEATS.probe + BEATS.gap}` },
      { label: 'Beat period 2π/|ω₁ − ω₂| of the scheme', value: show(pred.beatPeriod, 6, ' steps') },
      { label: 'Envelope speed Δω/Δk of the scheme', value: show(pred.envelopeSpeed, 6, ' cells/step') },
    ] : [
      { label: 'Packet width at the start, rms', value: `${num(m.width[0], 5)} cells` },
    ]),
  ];
  const steps: Step[] = [];
  for (let f = 0; f < frames.length; f++) {
    const t = f * EVERY;
    const u = frames[f];
    const [lo, hi, peak] = support(u);
    if (!beats) for (const x of crests(u, 0.5 * peak)) crestPts.push([t, x]);
    // the line is drawn where the wave is, joined to the fixed ends at zero
    const line: XY[] = [[0, 0]];
    for (let x = lo; x <= hi; x++) line.push([x, u[x]]);
    line.push([n - 1, 0]);
    const env: XY[] = []; const below: XY[] = [];
    for (let x = Math.max(dem.half, lo - (lo % 4)); x <= Math.min(n - 1 - dem.half, hi); x += 4) {
      const e = envelopeAt(u, x, dem);
      env.push([x, e]); below.push([x, -e]);
    }
    const layers: Layer[] = [
      { kind: 'curve', pts: env, weight: 1.5, tone: 0.8, alpha: 0.7 },
      { kind: 'curve', pts: below, weight: 1.5, tone: 0.8, alpha: 0.7 },
      { kind: 'curve', pts: line, weight: 1, alpha: 0.9 },
    ];
    const vgNow = vgAt[t];
    const wNow = wAt[t];
    const vpNow = wNow / s.k0;
    let rows: { label: string; value: string }[];
    if (beats) {
      const pa = nodesA.filter((x) => x <= t); const pb = nodesB.filter((x) => x <= t);
      layers.push(
        { kind: 'segments', segs: probeSegs, weight: 1, tone: 0.2, alpha: 0.6 },
        { kind: 'curve', panel: 1, pts: probeA, n: t + 1, weight: 1.5, tone: 0.2 },
        { kind: 'curve', panel: 1, pts: probeB, n: t + 1, weight: 1.5, tone: 0.55 },
        { kind: 'points', panel: 1, pts: nodeA, n: pa.length, size: 6, tone: 0.2 },
        { kind: 'points', panel: 1, pts: nodeB, n: pb.length, size: 6, tone: 0.55 },
      );
      rows = [
        { label: 'Beat nodes at the first probe', value: int(pa.length) },
        { label: 'Beat period at the probe, measured', value: show(beatPeriod(pa), 6, ' steps') },
        { label: 'Envelope speed between the probes, measured', value: show(envelopeSpeed(pa, pb, BEATS.gap), 6, ' cells/step') },
      ];
    } else {
      layers.push(
        { kind: 'segments', segs: [[m.centre[t], -amp, m.centre[t], amp]], weight: 1.5, tone: 0.2, alpha: 0.8 },
        { kind: 'points', panel: 1, pts: crestPts, n: crestPts.length, size: 2, alpha: 0.7 },
        { kind: 'points', panel: 1, pts: centrePts, n: t + 1, size: 3, tone: 0.2 },
        // the closed form through the start: the envelope at v_g, a crest at v_p
        vgLine, vpLine,
      );
      rows = [
        { label: 'Packet centre ⟨x⟩ = Σx u²/Σu²', value: `${num(m.centre[t])} cells` },
        { label: 'Packet width, rms', value: `${num(m.width[t], 5)} cells` },
        { label: 'Group velocity, measured from the packet centre', value: show(vgNow, 6, ' cells/step') },
        { label: 'Frequency ω, measured from the carrier phase', value: show(wNow, 6, ' rad/step') },
        { label: 'Phase velocity, measured from the carrier phase', value: show(vpNow, 6, ' cells/step') },
        { label: 'Group over phase velocity, measured', value: show(vgNow / vpNow, 6) },
        { label: 'Group minus phase velocity, measured', value: show(vgNow - vpNow, 6, ' cells/step') },
      ];
    }
    layers.push({ kind: 'text', x: n * 0.98, y: amp * 0.85, text: `t = ${t}`, align: 'right' });
    const measured = beats || !Number.isFinite(vgNow) ? [] : [
      { name: 'measured group velocity at k₀', points: [[s.k0, vgNow]] as XY[] },
      { name: 'measured phase velocity at k₀', points: [[s.k0, vpNow]] as XY[] },
    ];
    steps.push({
      layers,
      stats: [{ label: 'Time step t', value: `${int(t)} of ${int(STEPS)}` }, ...rows, ...fixed],
      chart: { title: chartTitle, ...chartAxes, series: [...series, ...measured] },
    });
    if (f % 4 === 3) yield;
  }
  return { panels, steps };
}

export const kernel: NumericKernel = {
  params: [
    select('experiment', 'Experiment', 'packet', [
      { value: 'packet', label: 'A wave packet' },
      { value: 'beats', label: 'Beats of two close wavenumbers' },
    ]),
    select('k0', 'Carrier wavenumber k₀', '1.6', K0S.map((k) => ({ value: k, label: `${k} rad/cell` }))),
    select('c2', 'Courant number squared C²', '0.5', C2S.map((c) => ({ value: c, label: c === '1' ? '1 (no dispersion)' : c }))),
  ],
  thumb: 0.6,
  build,
  run: (inp) => drain(build(inp)),
};
