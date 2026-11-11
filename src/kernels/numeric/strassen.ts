// Strassen's seven products of quadrant sums in place of the eight quadrant products, applied
// recursively down to single entries; every scalar multiplication and addition is counted.
import { mulberry32 } from '../../core/random';
import { fmt, int, logSlope, Meter, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';
import { zeros, type Mat } from './_linalg';

/** The textbook triple loop: n³ multiplications. */
export function naiveMul(A: Mat, B: Mat, m = new Meter()): Mat {
  const n = A.length; const p = B[0].length;
  const C = zeros(n, p);
  for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) {
    let s = 0;
    for (let k = 0; k < B.length; k++) s = k ? m.add(s, m.mul(A[i][k], B[k][j])) : m.mul(A[i][k], B[k][j]);
    C[i][j] = s;
  }
  return C;
}

const quad = (A: Mat, r: number, c: number, h: number): Mat => A.slice(r, r + h).map((row) => row.slice(c, c + h));
const plus = (m: Meter, A: Mat, B: Mat): Mat => A.map((row, i) => row.map((v, j) => m.add(v, B[i][j])));
const minus = (m: Meter, A: Mat, B: Mat): Mat => A.map((row, i) => row.map((v, j) => m.sub(v, B[i][j])));

/** Operand quadrants of each of the seven products, as [A quadrants, B quadrants]. */
export const PRODUCTS: [string[], string[], string][] = [
  [['11', '22'], ['11', '22'], 'M1 = (A11 + A22)(B11 + B22)'],
  [['21', '22'], ['11'], 'M2 = (A21 + A22) B11'],
  [['11'], ['12', '22'], 'M3 = A11 (B12 − B22)'],
  [['22'], ['21', '11'], 'M4 = A22 (B21 − B11)'],
  [['11', '12'], ['22'], 'M5 = (A11 + A12) B22'],
  [['21', '11'], ['11', '12'], 'M6 = (A21 − A11)(B11 + B12)'],
  [['12', '22'], ['21', '22'], 'M7 = (A12 − A22)(B21 + B22)'],
];

/** C = A B for square matrices whose size is a power of two. `top` sees the seven top products. */
export function strassen(A: Mat, B: Mat, m = new Meter(), top?: (k: number, M: Mat) => void): Mat {
  const n = A.length;
  if (n === 1) return [[m.mul(A[0][0], B[0][0])]];
  const h = n / 2;
  const [a11, a12, a21, a22] = [quad(A, 0, 0, h), quad(A, 0, h, h), quad(A, h, 0, h), quad(A, h, h, h)];
  const [b11, b12, b21, b22] = [quad(B, 0, 0, h), quad(B, 0, h, h), quad(B, h, 0, h), quad(B, h, h, h)];
  const M: Mat[] = [];
  const go = (X: Mat, Y: Mat) => { const r = strassen(X, Y, m); M.push(r); top?.(M.length - 1, r); };
  go(plus(m, a11, a22), plus(m, b11, b22));
  go(plus(m, a21, a22), b11);
  go(a11, minus(m, b12, b22));
  go(a22, minus(m, b21, b11));
  go(plus(m, a11, a12), b22);
  go(minus(m, a21, a11), plus(m, b11, b12));
  go(minus(m, a12, a22), plus(m, b21, b22));
  const [M1, M2, M3, M4, M5, M6, M7] = M;
  const c11 = plus(m, minus(m, plus(m, M1, M4), M5), M7);
  const c12 = plus(m, M3, M5);
  const c21 = plus(m, M2, M4);
  const c22 = plus(m, plus(m, minus(m, M1, M2), M3), M6);
  const C = zeros(n, n);
  for (let i = 0; i < h; i++) for (let j = 0; j < h; j++) {
    C[i][j] = c11[i][j]; C[i][j + h] = c12[i][j]; C[i + h][j] = c21[i][j]; C[i + h][j + h] = c22[i][j];
  }
  return C;
}

/** The quadrant sums of C from the products known so far (missing ones count as zero). */
function partialC(M: (Mat | undefined)[], h: number): Mat {
  const get = (k: number, i: number, j: number) => M[k]?.[i][j] ?? 0;
  const C = zeros(2 * h, 2 * h);
  for (let i = 0; i < h; i++) for (let j = 0; j < h; j++) {
    C[i][j] = get(0, i, j) + get(3, i, j) - get(4, i, j) + get(6, i, j);
    C[i][j + h] = get(2, i, j) + get(4, i, j);
    C[i + h][j] = get(1, i, j) + get(3, i, j);
    C[i + h][j + h] = get(0, i, j) - get(1, i, j) + get(2, i, j) + get(5, i, j);
  }
  return C;
}

const SIZES = [1, 2, 4, 8, 16, 32];

let cached: ReturnType<typeof measureCounts> | undefined;

/** Measured once per page: the counts do not depend on the input. */
export const counts = () => (cached ??= measureCounts());

function measureCounts(): { s: XY[]; n: XY[]; sa: XY[] } {
  const s: XY[] = []; const n: XY[] = []; const sa: XY[] = [];
  for (const k of SIZES) {
    const X = Array.from({ length: k }, () => new Array<number>(k).fill(1));
    const ms = new Meter(); const mn = new Meter();
    strassen(X, X, ms);
    naiveMul(X, X, mn);
    s.push([k, ms.get('mul')]); n.push([k, mn.get('mul')]); sa.push([k, ms.get('add')]);
  }
  return { s, n, sa };
}

const flat = (A: Mat) => A.flat();

export const kernel: NumericKernel = {
  params: [{ kind: 'select', key: 'n', label: 'Matrix size', value: '16', rebuild: true,
    options: ['4', '8', '16', '32'].map((v) => ({ value: v, label: `${v} × ${v}` })) }],
  rate: 0.8,
  aspect: 2.2,
  palette: 'spectral',
  run({ seed, params }) {
    const rnd = mulberry32(seed);
    const n = Number(params.n ?? 16);
    const h = n / 2;
    const rand = () => Array.from({ length: n }, () => Array.from({ length: n }, () => Math.floor(rnd() * 19) - 9));
    const A = rand(); const B = rand();
    const m = new Meter();
    const tops: { M: Mat; mul: number; add: number }[] = [];
    const C = strassen(A, B, m, (_, M) => tops.push({ M, mul: m.get('mul'), add: m.get('add') }));
    const ref = naiveMul(A, B);
    const err = Math.max(...C.flatMap((row, i) => row.map((v, j) => Math.abs(v - ref[i][j]))));
    const cmax = Math.max(...flat(ref).map(Math.abs), 1);
    const { s, n: nv, sa } = counts();
    const chart = {
      title: 'Scalar operations against size', x: { label: 'n', log: true }, y: { label: 'operations', log: true },
      series: [{ name: 'Strassen multiplications', points: s }, { name: 'Strassen additions', points: sa }, { name: 'Triple loop multiplications', points: nv }],
    };
    const box = (q: string): [number, number, number, number, number] => {
      const r = q[0] === '1' ? 0 : h; const c = q[1] === '1' ? 0 : h;
      return [c, n - r - h, h, h, -1];
    };
    const steps = Array.from({ length: 8 }, (_, k) => {
      const known = tops.slice(0, k).map((t) => t.M);
      const Ck = k === 7 ? C : partialC(known, h);
      const layers: Layer[] = [
        { kind: 'grid', rows: n, cols: n, values: flat(A), lo: -9, hi: 9 },
        { kind: 'grid', panel: 1, rows: n, cols: n, values: flat(B), lo: -9, hi: 9 },
        { kind: 'grid', panel: 2, rows: n, cols: n, values: flat(Ck), lo: -cmax, hi: cmax },
      ];
      if (k < 7) {
        const [qa, qb] = PRODUCTS[k];
        layers.push({ kind: 'rects', rects: qa.map((q) => box(q)), outline: true });
        layers.push({ kind: 'rects', panel: 1, rects: qb.map((q) => box(q)), outline: true });
      }
      const done = k ? tops[k - 1] : { mul: 0, add: 0 };
      return {
        layers,
        stats: [
          { label: k < 7 ? 'Computing' : 'Done', value: k < 7 ? PRODUCTS[k][2] : 'C assembled from M1 … M7' },
          { label: 'Multiplications', value: `${int(k === 7 ? m.get('mul') : done.mul)} of ${int(m.get('mul'))} (triple loop ${int(n ** 3)})` },
          { label: 'Additions', value: int(k === 7 ? m.get('add') : done.add) },
          { label: 'Measured growth of multiplications', value: `n^${fmt(logSlope(s), 3)} (triple loop n^${fmt(logSlope(nv), 3)})` },
          { label: 'max |C − triple loop|', value: k === 7 ? fmt(err) : 'pending' },
        ],
      };
    });
    return {
      panels: [
        { title: 'A', x: [0, n], y: [0, n], equal: true },
        { title: 'B', x: [0, n], y: [0, n], equal: true },
        { title: 'C from the products so far', x: [0, n], y: [0, n], equal: true },
      ],
      steps,
      chart,
    };
  },
};
