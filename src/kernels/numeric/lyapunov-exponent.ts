// The largest Lyapunov exponent by Benettin's method: follow a reference orbit and a neighbour a
// distance d0 away, measure how far apart they are after each interval, add the logarithm of
// the growth and pull the neighbour back to d0 along the same direction. The running mean is
// the exponent, in nats per unit time (flows) or per iteration (maps).
import { mulberry32 } from '../../core/random';
import { drain, fmt, int, mapSliced, span, type Layer, type NumericKernel, type NumericRun, type RunInput, type XY } from '../../engines/numeric/trace';
import { henon, logistic, lorenz, rk4, type V3 } from './_systems';

export interface Estimate { running: XY[]; lambda: number; orbit: XY[] }

const D0 = 1e-8;

/** Benettin on the Lorenz flow: RK4 step h, renormalised every `every` steps. */
export function lorenzExponent(seed: number, time = 200, h = 0.01, every = 10): Estimate {
  return drain(lorenzSteps(seed, time, h, every));
}

/** lorenzExponent(), resumable: it yields every 100 renormalisations. */
export function* lorenzSteps(seed: number, time = 200, h = 0.01, every = 10): Generator<void, Estimate, void> {
  const rnd = mulberry32(seed);
  let a: V3 = [1 + rnd(), 1 + rnd(), 20 + rnd()];
  for (let i = 0; i < 3000; i++) a = rk4(lorenz, a, h);
  let b: V3 = [a[0] + D0, a[1], a[2]];
  let sum = 0;
  const running: XY[] = []; const orbit: XY[] = [];
  const intervals = Math.round(time / (h * every));
  for (let k = 1; k <= intervals; k++) {
    for (let s = 0; s < every; s++) { a = rk4(lorenz, a, h); b = rk4(lorenz, b, h); }
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    sum += Math.log(d / D0);
    b = [0, 1, 2].map((i) => a[i] + ((b[i] - a[i]) * D0) / d) as V3;
    const t = k * h * every;
    running.push([t, sum / t]);
    orbit.push([a[0], a[2]]);
    if (k % 100 === 0) yield;
  }
  return { running, lambda: sum / (intervals * h * every), orbit };
}

/** Benettin on a 1D or 2D map, renormalised every iteration. */
export function mapExponent(kind: 'logistic' | 'logistic-periodic' | 'henon', seed: number, iterations = 20000): Estimate {
  return drain(mapSteps(kind, seed, iterations));
}

/** mapExponent(), resumable: it yields every 2000 iterations. */
export function* mapSteps(kind: 'logistic' | 'logistic-periodic' | 'henon', seed: number, iterations = 20000): Generator<void, Estimate, void> {
  const rnd = mulberry32(seed);
  const r = kind === 'logistic' ? 4 : 3.5;
  const f = (p: [number, number]): [number, number] => (kind === 'henon' ? henon(p) : [logistic(r, p[0]), 0]);
  let a: [number, number] = kind === 'henon' ? [0.1 * rnd(), 0.1 * rnd()] : [0.1 + 0.8 * rnd(), 0];
  for (let i = 0; i < 1000; i++) a = f(a);
  let b: [number, number] = [a[0] + D0, a[1]];
  let sum = 0;
  const running: XY[] = []; const orbit: XY[] = [];
  for (let k = 1; k <= iterations; k++) {
    const prev = a[0];
    a = f(a); b = f(b);
    let d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d === 0) d = Number.MIN_VALUE;
    sum += Math.log(d / D0);
    b = [a[0] + ((b[0] - a[0]) * D0) / d, a[1] + ((b[1] - a[1]) * D0) / d];
    // the logistic map at r = 4 can land on its fixed points in floating point; a fresh nudge
    // keeps the neighbour honest without touching the reference orbit
    if (b[0] === a[0] && b[1] === a[1]) b = [a[0] + D0, a[1]];
    running.push([k, sum / k]);
    orbit.push(kind === 'henon' ? [a[0], a[1]] : [prev, a[0]]);
    if (k % 2000 === 0) yield;
  }
  return { running, lambda: sum / iterations, orbit };
}

const SYSTEMS: Record<string, { label: string; unit: string; reference: string }> = {
  lorenz: { label: 'Lorenz flow (σ 10, ρ 28, β 8/3)', unit: 'per unit time', reference: 'published value ≈ 0.906' },
  henon: { label: 'Hénon map (a 1.4, b 0.3)', unit: 'per iteration', reference: 'published value ≈ 0.419' },
  logistic: { label: 'Logistic map, r = 4', unit: 'per iteration', reference: 'exact value ln 2 ≈ 0.6931' },
  'logistic-periodic': { label: 'Logistic map, r = 3.5 (period 4)', unit: 'per iteration', reference: 'negative: the orbit is periodic and stable' },
};

function* build({ seed, params }: RunInput): Generator<void, NumericRun, void> {
  const key = String(params.system ?? 'lorenz');
  const sys = SYSTEMS[key] ?? SYSTEMS.lorenz;
  const est = key === 'lorenz' ? yield* lorenzSteps(seed) : yield* mapSteps(key as 'henon', seed);
  const N = est.running.length;
  yield;
  const tail = est.running.slice(Math.floor(N * 0.1));
  const ry = span(tail.map((q) => q[1]), 0.3);
  yield;
  const ox = span(est.orbit.map((q) => q[0])); const oy = span(est.orbit.map((q) => q[1]));
  yield;
  const stride = Math.max(1, Math.ceil(N / 5000));
  const orbit = est.orbit.filter((_, i) => i % stride === 0);
  // the chart's thinned running estimate, sampled once: each step shows its leading part and
  // its own latest value, the same points as filtering the whole series at every step
  const every = Math.max(1, Math.floor(N / 400));
  const thinned = est.running.filter((_, i) => i % every === 0);
  yield;
  const marks = Array.from({ length: 160 }, (_, i) => Math.max(1, Math.round(((i + 1) * N) / 160)));
  const steps = yield* mapSliced(marks, (n) => {
    const layers: Layer[] = [
      { kind: 'points', pts: orbit, n: Math.ceil(n / stride), size: 1.5, tone: 0.2, alpha: 0.7 },
      { kind: 'points', pts: [est.orbit[n - 1]], size: 9, tone: 0.9 },
      { kind: 'curve', panel: 1, pts: est.running, n, tone: 0.85, weight: 2 },
    ];
    const [t, l] = est.running[n - 1];
    return {
      layers,
      stats: [
        { label: 'Running estimate λ', value: `${fmt(l)} ${sys.unit}` },
        { label: key === 'lorenz' ? 'Time integrated' : 'Iterations', value: key === 'lorenz' ? fmt(t) : int(t) },
        { label: 'Renormalisations', value: int(n) },
        { label: 'Reference', value: sys.reference },
        { label: 'Method', value: key === 'lorenz' ? 'two RK4 orbits, h 0.01, renormalised every 0.1' : 'two orbits, renormalised every iteration' },
      ],
      chart: {
        title: 'Running estimate of the largest exponent', x: { label: key === 'lorenz' ? 'time' : 'iterations', log: true }, y: { label: 'λ' },
        series: [{ name: 'Benettin', points: (n - 1) % every ? [...thinned.slice(0, Math.ceil(n / every)), est.running[n - 1]] : thinned.slice(0, Math.ceil(n / every)) }],
      },
    };
  }, 8);
  return {
    panels: [
      { title: key === 'lorenz' ? 'Reference orbit (x, z)' : key === 'henon' ? 'Reference orbit (x, y)' : 'Reference orbit: each iterate against the next', x: ox, y: oy },
      { title: 'Running mean of the log growth', x: [0, est.running[N - 1][0]], y: [Math.min(ry[0], 0), Math.max(ry[1], 0)], axes: true },
    ],
    steps,
  };
}

export const kernel: NumericKernel = {
  params: [{ kind: 'select', key: 'system', label: 'System', value: 'lorenz', rebuild: true,
    options: Object.entries(SYSTEMS).map(([value, s]) => ({ value, label: s.label })) }],
  thumb: 1,
  build,
  run: (inp) => drain(build(inp)),
};
