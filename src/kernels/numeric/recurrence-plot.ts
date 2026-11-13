// A recurrence plot: R(i, j) = 1 when the embedded states i and j are closer than ε, with ε set
// so that a chosen share of all pairs recur. Recurrence quantification reads its texture:
// diagonal lines are stretches where the trajectory runs parallel to its past (determinism),
// vertical ones where it lingers (laminarity).
import { drain, fmt, int, type Layer, type NumericKernel, type NumericRun, type RunInput, type XY } from '../../engines/numeric/trace';
import { embed } from './_embed';
import { logisticSeries, lorenzOrbit, noise } from './_systems';

export interface RQA { rr: number; det: number; lam: number; meanDiag: number; maxDiag: number; entropy: number; diagHist: number[] }

/** The recurrence matrix of states under the Euclidean distance and threshold eps. */
export function recurrence(states: number[][], eps: number): Uint8Array {
  return drain(recurrenceSteps(states, eps));
}

/**
 * recurrence(), resumable: it yields after every 64 rows. A pair recurs when its squared
 * distance is at most eps2, eps² unless given: the plate passes the selected squared distance
 * itself, since squaring a square root rounds below it and would drop the pairs tied with it.
 */
export function* recurrenceSteps(states: number[][], eps: number, eps2 = eps * eps): Generator<void, Uint8Array, void> {
  const n = states.length;
  const R = new Uint8Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
    let d = 0;
    for (let c = 0; c < states[i].length; c++) d += (states[i][c] - states[j][c]) ** 2;
    if (d <= eps2) { R[i * n + j] = 1; R[j * n + i] = 1; }
    if (j === n - 1 && (i & 63) === 63) yield;
  }
  return R;
}

/** The k-th smallest value of d (0-based), as sorting would place it; d is reordered. Hoare's selection. */
export function select(d: Float64Array, k: number): number {
  let lo = 0; let hi = d.length - 1;
  while (lo < hi) {
    const x = d[(lo + hi) >> 1];
    let i = lo; let j = hi;
    while (i <= j) {
      while (d[i] < x) i++;
      while (d[j] > x) j--;
      if (i <= j) { const t = d[i]; d[i] = d[j]; d[j] = t; i++; j--; }
    }
    if (k <= j) hi = j; else if (k >= i) lo = i; else return d[k];
  }
  return d[k];
}

/** The threshold under which a share `rate` of the off-diagonal pairs fall. */
export function thresholdFor(states: number[][], rate: number): number {
  return drain(thresholdSteps(states, rate));
}

/** thresholdFor(), resumable: the square root of thresholdSquaredSteps(), the same value as
 * selecting among the distances themselves, since the square root keeps their order. */
export function* thresholdSteps(states: number[][], rate: number): Generator<void, number, void> {
  return Math.sqrt(yield* thresholdSquaredSteps(states, rate));
}

/**
 * The k-th smallest squared pair distance, k = floor(rate·M) of the M off-diagonal pairs, so that
 * comparing squared distances with it keeps at least k pairs, ties included; resumable, it yields
 * after every 64 rows of distances.
 */
export function* thresholdSquaredSteps(states: number[][], rate: number): Generator<void, number, void> {
  const n = states.length;
  const d = new Float64Array((n * (n - 1)) / 2);
  let at = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    let s = 0;
    for (let c = 0; c < states[i].length; c++) s += (states[i][c] - states[j][c]) ** 2;
    d[at++] = s;
    if (j === n - 1 && (i & 63) === 63) yield;
  }
  const k = Math.min(d.length - 1, Math.max(0, Math.floor(rate * d.length) - 1));
  return k >= 0 ? select(d, k) : 0;
}

/** Quantification of the leading k × k block, the main diagonal excluded; lines of length >= lmin. */
export function rqa(R: Uint8Array, n: number, k = n, lmin = 2): RQA {
  let rec = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) if (i !== j && R[i * n + j]) rec++;
  const diagHist = new Array<number>(k + 1).fill(0);
  // diagonals above the main one, counted twice for the symmetric half below
  for (let off = 1; off < k; off++) {
    let run = 0;
    for (let i = 0; i + off <= k; i++) {
      const on = i + off < k && R[i * n + i + off] === 1;
      if (on) run++;
      else if (run) { diagHist[run] += 2; run = 0; }
    }
  }
  const vert = new Array<number>(k + 1).fill(0);
  for (let j = 0; j < k; j++) {
    let run = 0;
    for (let i = 0; i <= k; i++) {
      const on = i < k && i !== j && R[i * n + j] === 1;
      if (on) run++;
      else if (run) { vert[run]++; run = 0; }
    }
  }
  let inDiag = 0; let lines = 0; let lenSum = 0; let maxDiag = 0;
  diagHist.forEach((c, l) => { if (l >= lmin && c) { inDiag += c * l; lines += c; lenSum += c * l; maxDiag = l; } });
  let inVert = 0;
  vert.forEach((c, l) => { if (l >= lmin) inVert += c * l; });
  let entropy = 0;
  diagHist.forEach((c, l) => { if (l >= lmin && c) { const p = c / lines; entropy -= p * Math.log(p); } });
  const pairs = k * (k - 1);
  return { rr: pairs ? rec / pairs : 0, det: rec ? inDiag / rec : 0, lam: rec ? inVert / rec : 0,
    meanDiag: lines ? lenSum / lines : 0, maxDiag, entropy, diagHist };
}

export function series(kind: string, n: number, seed: number): { s: number[]; m: number; tau: number } {
  switch (kind) {
    case 'sine': return { s: Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * i) / 23)), m: 2, tau: 6 };
    case 'noise': return { s: noise(n, seed), m: 2, tau: 1 };
    case 'regime': {
      const a = logisticSeries(3.5, Math.floor(n / 2), seed);
      const b = logisticSeries(3.9, n - a.length, seed + 1);
      return { s: [...a, ...b], m: 2, tau: 1 };
    }
    case 'lorenz': return { s: lorenzOrbit(seed, n, 0.01, 5).map((v) => v[0]), m: 3, tau: 3 };
    default: return { s: logisticSeries(4, n, seed), m: 2, tau: 1 };
  }
}

function* build({ seed, params }: RunInput): Generator<void, NumericRun, void> {
  const len = Number(params.length ?? 300);
  const { s, m, tau } = series(String(params.series ?? 'regime'), len + 4 * 3, seed);
  const states = embed(s, m, tau).slice(0, len);
  const n = states.length;
  // squared distances against the selected squared distance, so ties with it recur; ε for display
  const eps2 = yield* thresholdSquaredSteps(states, Number(params.rate ?? 8) / 100);
  const eps = Math.sqrt(eps2);
  yield;
  const R = yield* recurrenceSteps(states, eps, eps2);
  yield;
  // recurrent states in a mid tone of the palette, which reads on both grounds
  const values = new Float64Array(R.length);
  for (let i = 0; i < R.length; i++) values[i] = 0.3 * R[i];
  yield;
  const lo = Math.min(...s); const hi = Math.max(...s);
  const ticks = Array.from({ length: 60 }, (_, i) => Math.max(8, Math.round(((i + 1) * n) / 60)));
  const steps: NumericRun['steps'] = [];
  for (const k of ticks) {
    const q = rqa(R, n, k);
    const layers: Layer[] = [
      { kind: 'grid', rows: n, cols: n, values, lo: 0, hi: 1, clear: 0, rowsShown: k },
      { kind: 'segments', segs: [[0, n - k, k, n - k], [k, n - k, k, n]], alpha: 0.5 },
      { kind: 'curve', panel: 1, pts: s.slice(0, n).map((v, i) => [v, n - i] as XY), tone: 0.6, weight: 1.2 },
      { kind: 'segments', panel: 1, segs: [[lo, n - k, hi, n - k]], alpha: 0.5 },
    ];
    steps.push({
      layers,
      stats: [
        { label: 'States', value: `${int(k)} of ${int(n)} (m ${m}, τ ${tau}, ε ${fmt(eps)})` },
        { label: 'Recurrence rate', value: `${fmt(100 * q.rr, 3)}%` },
        { label: 'Determinism (diagonal lines ≥ 2)', value: `${fmt(100 * q.det, 3)}%` },
        { label: 'Laminarity (vertical lines ≥ 2)', value: `${fmt(100 * q.lam, 3)}%` },
        { label: 'Diagonal lines', value: `mean ${fmt(q.meanDiag, 3)}, longest ${int(q.maxDiag)}, entropy ${fmt(q.entropy, 3)}` },
        { label: 'Longest diagonal line', value: `${int(q.maxDiag)} points` },
      ],
      chart: {
        title: 'Diagonal line lengths', x: { label: 'line length' }, y: { label: 'lines', log: true },
        series: [{ name: 'Measured', points: q.diagHist.map((c, l) => [l, c] as XY).filter(([l, c]) => l >= 2 && c > 0) }],
      },
    });
    yield;
  }
  return {
    panels: [
      { title: 'Recurrence plot (time runs down and right)', x: [0, n], y: [0, n], equal: true, weight: 1.6 },
      { title: 'The series, time downwards', x: [lo - 0.05 * (hi - lo), hi + 0.05 * (hi - lo)], y: [0, n], weight: 0.6 },
    ],
    steps,
  };
}

export const kernel: NumericKernel = {
  params: [
    { kind: 'select', key: 'series', label: 'Series', value: 'regime', rebuild: true,
      options: [{ value: 'regime', label: 'Logistic map, periodic then chaotic' }, { value: 'sine', label: 'Sine wave' },
        { value: 'logistic', label: 'Logistic map, r = 4' }, { value: 'lorenz', label: 'x(t) of the Lorenz flow' }, { value: 'noise', label: 'Gaussian white noise' }] },
    { kind: 'range', key: 'rate', label: 'Recurrence rate target (%)', min: 2, max: 20, step: 1, value: 8, rebuild: true },
    { kind: 'range', key: 'length', label: 'Length', min: 100, max: 400, step: 20, value: 300, rebuild: true },
  ],
  aspect: 1.5,
  palette: 'ember',
  build,
  run: (inp) => drain(build(inp)),
};
