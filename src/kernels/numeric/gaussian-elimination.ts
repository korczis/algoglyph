// Gaussian elimination with optional partial pivoting on the augmented matrix [A | b], one row
// operation per step, then back substitution; multiplications, swaps and the residual are
// measured from the run itself.
import { mulberry32 } from '../../core/random';
import { fmt, int, logSlope, Meter, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';
import type { Mat } from './_linalg';

export interface Snapshot { M: Mat; row: number; col: number; pivot: number; swap: boolean }

export interface Solve { x: number[]; snapshots: Snapshot[]; swaps: number; mul: number; det: number; singular: boolean }

/** Solve A x = b. With `pivot`, each column's pivot is its largest remaining entry. */
export function gauss(A: Mat, b: number[], pivot = true, record = false): Solve {
  const n = A.length;
  const M = A.map((r, i) => [...r, b[i]]);
  const m = new Meter();
  const snapshots: Snapshot[] = [];
  const snap = (row: number, col: number, p: number, swap: boolean) => {
    if (record) snapshots.push({ M: M.map((r) => r.slice()), row, col, pivot: p, swap });
  };
  let swaps = 0;
  let det = 1;
  let singular = false;
  snap(-1, -1, -1, false);
  for (let k = 0; k < n; k++) {
    let p = k;
    if (pivot) for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    if (p !== k) { [M[p], M[k]] = [M[k], M[p]]; swaps++; det = -det; snap(k, k, k, true); }
    if (M[k][k] === 0) { singular = true; det = 0; continue; }
    det *= M[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      m.tick('div');
      for (let j = k + 1; j <= n; j++) M[i][j] = m.sub(M[i][j], m.mul(f, M[k][j]));
      M[i][k] = 0;
      snap(i, k, k, false);
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s = m.sub(s, m.mul(M[i][j], x[j]));
    x[i] = s / M[i][i];
  }
  return { x, snapshots, swaps, mul: m.get('mul'), det, singular };
}

export function residual(A: Mat, x: number[], b: number[]): number {
  return Math.max(...A.map((r, i) => Math.abs(r.reduce((s, v, j) => s + v * x[j], 0) - b[i])));
}

/** Seeded systems: random, or one whose first pivot is tiny (where pivoting matters). */
export function system(kind: string, n: number, seed: number): { A: Mat; b: number[]; x: number[] } {
  const rnd = mulberry32(seed);
  const A = Array.from({ length: n }, () => Array.from({ length: n }, () => 2 * rnd() - 1));
  if (kind === 'tiny-pivot') A[0][0] = 1e-14;
  const x = Array.from({ length: n }, () => Math.round(10 * (2 * rnd() - 1)) / 2);
  const b = A.map((r) => r.reduce((s, v, j) => s + v * x[j], 0));
  return { A, b, x };
}

export const kernel: NumericKernel = {
  params: [
    { kind: 'range', key: 'n', label: 'Unknowns', min: 3, max: 14, step: 1, value: 8, rebuild: true },
    { kind: 'select', key: 'system', label: 'System', value: 'random', rebuild: true,
      options: [{ value: 'random', label: 'Random' }, { value: 'tiny-pivot', label: 'Tiny first pivot' }] },
    { kind: 'toggle', key: 'pivot', label: 'Partial pivoting', value: true, rebuild: true },
  ],
  rate: 3,
  thumb: 0.6,
  aspect: 16 / 9,
  run({ seed, params }) {
    const n = Number(params.n ?? 8);
    const pivot = params.pivot !== false;
    const { A, b, x: truth } = system(String(params.system ?? 'random'), n, seed);
    const s = gauss(A, b, pivot, true);
    const other = gauss(A, b, !pivot);
    const res = residual(A, s.x, b);
    const fe = Math.max(...s.x.map((v, i) => Math.abs(v - truth[i])));
    const work: XY[] = []; const expect: XY[] = [];
    for (let k = 2; k <= 64; k *= 2) {
      const q = system('random', k, seed + k);
      work.push([k, gauss(q.A, q.b, true).mul]);
      expect.push([k, (k ** 3) / 3]);
    }
    const chart = {
      title: 'Multiplications against unknowns', x: { label: 'n', log: true }, y: { label: 'multiplications', log: true },
      series: [{ name: 'Measured', points: work }, { name: 'n³ / 3', points: expect }],
    };
    const lim = Math.max(1, ...A.flat().map(Math.abs), ...b.map(Math.abs));
    const growth = (M: Mat) => Math.max(...M.flatMap((r) => r.slice(0, n).map(Math.abs))) / Math.max(...A.flat().map(Math.abs));
    const steps = s.snapshots.map((q, k) => {
      const layers: Layer[] = [
        // a signed log scale keeps tiny and huge entries apart
        { kind: 'grid', rows: n, cols: n + 1, values: q.M.flat().map((v) => Math.sign(v) * Math.log10(1 + Math.abs(v) / (lim * 1e-3))), lo: -Math.log10(1 + 1e3) - 1, hi: Math.log10(1 + 1e3) + 1, clear: 0 },
        { kind: 'segments', segs: [[n, 0, n, n]], alpha: 0.6, weight: 2 },
      ];
      if (q.col >= 0) {
        layers.push({ kind: 'rects', rects: [[q.col, n - q.pivot - 1, 1, 1, -1]], outline: true });
        layers.push({ kind: 'rects', rects: [[0, n - q.row - 1, n + 1, 1, 0.5]], alpha: 0.15 });
      }
      const last = k === s.snapshots.length - 1;
      return {
        layers,
        stats: [
          { label: 'Operation', value: q.col < 0 ? 'start' : q.swap ? `swap rows ${q.row + 1} and pivot row` : `row ${q.row + 1} −= f · row ${q.col + 1}` },
          { label: 'Row swaps', value: int(s.snapshots.slice(0, k + 1).filter((t) => t.swap).length) },
          { label: 'Growth of entries', value: fmt(growth(q.M)) },
          { label: 'Residual max |Ax − b|', value: last ? fmt(res) : `after back substitution (${fmt(res)})` },
          { label: 'Error against the planted solution', value: `${fmt(fe)} (${pivot ? 'without' : 'with'} pivoting: ${fmt(Math.max(...other.x.map((v, i) => Math.abs(v - truth[i]))))})` },
          { label: 'Multiplications', value: `${int(s.mul)} in all (measured n^${fmt(logSlope(work), 3)})` },
        ],
      };
    });
    return {
      panels: [{ title: 'Augmented matrix [A | b], signed log scale', x: [0, n + 1], y: [0, n], equal: true }],
      steps,
      chart,
    };
  },
};
