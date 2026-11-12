// Principal components by the one-sided Jacobi SVD: rotate pairs of columns of the centred data
// until every pair is orthogonal. The column norms are then the singular values, the rotations
// the principal axes, and each step of the plate is one rotation.
import { gaussian, mulberry32 } from '../../core/random';
import { drain, fmt, int, mapSliced, type Layer, type NumericKernel, type NumericRun, type RunInput, type XY } from '../../engines/numeric/trace';
import type { Mat } from './_linalg';

export interface Rotation { i: number; j: number; V: Mat; U: Mat; off: number }

export interface SVD { U: Mat; s: number[]; V: Mat; sweeps: number; rotations: Rotation[] }

const col = (A: Mat, j: number) => A.map((r) => r[j]);
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

/** Largest |cos| between two columns: zero when the columns are orthogonal. */
export function offOrthogonality(W: Mat): number {
  const d = W[0].length;
  let off = 0;
  // the same sums, in the same order, as dot() over extracted columns, without the copies
  const sq = new Float64Array(d);
  for (let i = 0; i < d; i++) { let s = 0; for (let k = 0; k < W.length; k++) s += W[k][i] * W[k][i]; sq[i] = s; }
  for (let i = 0; i < d; i++) for (let j = i + 1; j < d; j++) {
    let ab = 0;
    for (let k = 0; k < W.length; k++) ab += W[k][i] * W[k][j];
    const na = Math.sqrt(sq[i]); const nb = Math.sqrt(sq[j]);
    if (na > 0 && nb > 0) off = Math.max(off, Math.abs(ab) / (na * nb));
  }
  return off;
}

/** X = U diag(s) Vᵀ, singular values descending, by cyclic one-sided Jacobi sweeps. */
export function jacobiSVD(X: Mat, record = false, tol = 1e-13, maxSweeps = 30): SVD {
  return drain(jacobiSteps(X, record, tol, maxSweeps));
}

/** jacobiSVD, resumable: it yields after every rotation. */
export function* jacobiSteps(X: Mat, record = false, tol = 1e-13, maxSweeps = 30): Generator<void, SVD, void> {
  const m = X.length; const d = X[0].length;
  const W = X.map((r) => r.slice());
  const V: Mat = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => (i === j ? 1 : 0)));
  const rotations: Rotation[] = [];
  let sweeps = 0;
  for (; sweeps < maxSweeps; sweeps++) {
    let rotated = false;
    for (let i = 0; i < d - 1; i++) for (let j = i + 1; j < d; j++) {
      let a = 0; let b = 0; let g = 0;
      for (let k = 0; k < m; k++) { a += W[k][i] ** 2; b += W[k][j] ** 2; g += W[k][i] * W[k][j]; }
      if (Math.abs(g) <= tol * Math.sqrt(a * b) || g === 0) continue;
      rotated = true;
      const zeta = (b - a) / (2 * g);
      const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
      const c = 1 / Math.sqrt(1 + t * t); const s = c * t;
      for (let k = 0; k < m; k++) { const x = W[k][i]; const y = W[k][j]; W[k][i] = c * x - s * y; W[k][j] = s * x + c * y; }
      for (let k = 0; k < d; k++) { const x = V[k][i]; const y = V[k][j]; V[k][i] = c * x - s * y; V[k][j] = s * x + c * y; }
      if (record) rotations.push({ i, j, V: V.map((r) => r.slice()), U: W.map((r) => r.slice()), off: offOrthogonality(W) });
      yield;
    }
    if (!rotated) break;
  }
  const norms = Array.from({ length: d }, (_, j) => Math.sqrt(dot(col(W, j), col(W, j))));
  const order = norms.map((_, j) => j).sort((p, q) => norms[q] - norms[p]);
  const s = order.map((j) => norms[j]);
  const U = W.map((r) => order.map((j) => (norms[j] ? r[j] / norms[j] : 0)));
  const Vs = V.map((r) => order.map((j) => r[j]));
  return { U, s, V: Vs, sweeps, rotations };
}

/** Rows of centred data in d dimensions with planted axis scales, rotated at random. */
export function cloud(seed: number, d: number, m: number): { X: Mat; scales: number[] } {
  const rnd = mulberry32(seed);
  const scales = Array.from({ length: d }, (_, k) => 3 * 0.55 ** k);
  let X = Array.from({ length: m }, () => scales.map((s) => s * gaussian(rnd)));
  for (let r = 0; r < 3 * d; r++) {
    const i = Math.floor(rnd() * d); const j = (i + 1 + Math.floor(rnd() * (d - 1))) % d;
    const th = rnd() * Math.PI;
    const c = Math.cos(th); const s = Math.sin(th);
    X = X.map((row) => { const out = row.slice(); out[i] = c * row[i] - s * row[j]; out[j] = s * row[i] + c * row[j]; return out; });
  }
  const mean = Array.from({ length: d }, (_, j) => X.reduce((s, r) => s + r[j], 0) / m);
  return { X: X.map((r) => r.map((v, j) => v - mean[j])), scales };
}

function* build({ seed, params }: RunInput): Generator<void, NumericRun, void> {
  const d = Number(params.dims ?? 4);
  const m = Number(params.points ?? 260);
  const { X } = cloud(seed, d, m);
  const svd = yield* jacobiSteps(X, true);
  const raw: XY[] = X.map((r) => [r[0], r[1]]);
  const lim = Math.max(...X.flat().map(Math.abs)) * 1.1;
  const total = svd.s.reduce((t, v) => t + v * v, 0);
  const first: Rotation = { i: 0, j: 0, V: Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => (i === j ? 1 : 0))), U: X, off: offOrthogonality(X) };
  const rots = [first, ...svd.rotations];
  const offs: XY[] = rots.map((r, k) => [k, Math.max(r.off, 1e-17)]);
  const steps = yield* mapSliced(rots, (r, k) => {
    const norms = Array.from({ length: d }, (_, j) => Math.sqrt(r.U.reduce((s, row) => s + row[j] ** 2, 0)));
    const order = norms.map((_, j) => j).sort((p, q) => norms[q] - norms[p]);
    const [p, q] = order;
    const axes: [number, number, number, number][] = order.map((j) => {
      const len = (2 * norms[j]) / Math.sqrt(m);
      return [-len * r.V[0][j], -len * r.V[1][j], len * r.V[0][j], len * r.V[1][j]];
    });
    const layers: Layer[] = [
      { kind: 'points', pts: raw, size: 3, tone: 0.2, alpha: 0.6 },
      ...axes.map((s, a) => ({ kind: 'segments' as const, segs: [s], tone: a === 0 ? 0.85 : a === 1 ? 0.6 : -1, weight: a < 2 ? 3 : 1.5, alpha: a < 2 ? 1 : 0.5 })),
      { kind: 'points', panel: 1, pts: r.U.map((row) => [row[p], row[q]] as XY), size: 3, tone: 0.75, alpha: 0.6 },
      { kind: 'rects', panel: 2, rects: order.map((j, a) => [a + 0.15, 0, 0.7, norms[j] ** 2 / total, a ? 0.3 : 0.85] as [number, number, number, number, number]) },
    ];
    return {
      layers,
      chart: { title: 'Largest |cos| between columns', x: { label: 'rotation' }, y: { label: 'off-orthogonality', log: true }, series: [{ name: 'One-sided Jacobi', points: offs.slice(0, k + 1) }] },
      stats: [
        { label: 'Rotation', value: k ? `${int(k)} (columns ${r.i + 1} and ${r.j + 1})` : 'start' },
        { label: 'Largest |cos| between columns', value: fmt(r.off) },
        { label: 'Variance on the leading column', value: `${fmt((100 * norms[p] ** 2) / total, 3)}%` },
        { label: 'Singular values at convergence', value: svd.s.map((v) => fmt(v, 3)).join(', ') },
        { label: 'Sweeps to converge', value: int(svd.sweeps) },
      ],
    };
  }, 1);
  return {
    panels: [
      { title: 'First two coordinates, current axes', x: [-lim, lim], y: [-lim, lim], equal: true, axes: true },
      { title: 'Two longest rotated columns', x: [-lim, lim], y: [-lim, lim], equal: true, axes: true },
      { title: 'Variance share', x: [0, d], y: [0, 1.02], weight: 0.6 },
    ],
    steps,
  };
}

export const kernel: NumericKernel = {
  params: [
    { kind: 'range', key: 'dims', label: 'Dimensions', min: 2, max: 6, step: 1, value: 4, rebuild: true },
    { kind: 'range', key: 'points', label: 'Points', min: 50, max: 600, step: 10, value: 260, rebuild: true },
  ],
  rate: 2,
  build,
  run: (inp) => drain(build(inp)),
};
