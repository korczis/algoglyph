// The simplex method on a tableau: maximise c·x subject to A x <= b, x >= 0, b >= 0, starting
// from the slack basis at the origin and pivoting to a neighbouring vertex while some reduced
// cost is positive. Dantzig's rule takes the largest, Bland's the first (it cannot cycle).
import { mulberry32 } from '../../core/random';
import { fmt, int, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';
import type { Mat } from './_linalg';

export interface Pivot { enter: number; leave: number; T: Mat; basis: number[]; x: number[]; value: number }

/**
 * How the method stopped: at an optimum, along an unbounded edge, on a basis it had already
 * visited (the rule is deterministic, so it would cycle for ever), or at the pivot limit.
 */
export type Status = 'optimal' | 'unbounded' | 'cycling' | 'pivot-limit';

export interface LP { status: Status; x: number[]; value: number; pivots: Pivot[] }

const EPS = 1e-12;

export function simplex(A: Mat, b: number[], c: number[], rule: 'dantzig' | 'bland' = 'dantzig', maxPivots = 500): LP {
  const m = A.length; const n = c.length;
  // rows: constraints [A | I | b]; last row: [-c | 0 | 0], whose entries are minus the reduced costs
  const T: Mat = A.map((row, i) => [...row, ...Array.from({ length: m }, (_, j) => (i === j ? 1 : 0)), b[i]]);
  T.push([...c.map((v) => -v), ...new Array<number>(m + 1).fill(0)]);
  const basis = Array.from({ length: m }, (_, i) => n + i);
  const point = () => {
    const x = new Array<number>(n).fill(0);
    basis.forEach((v, i) => { if (v < n) x[v] = T[i][n + m]; });
    return x;
  };
  const pivots: Pivot[] = [{ enter: -1, leave: -1, T: T.map((r) => r.slice()), basis: basis.slice(), x: point(), value: T[m][n + m] }];
  const seen = new Set<string>([basis.slice().sort((p, q) => p - q).join(',')]);
  for (let it = 0; it < maxPivots; it++) {
    const z = T[m];
    let e = -1;
    for (let j = 0; j < n + m; j++) {
      if (z[j] < -EPS && (e < 0 || (rule === 'dantzig' ? z[j] < z[e] : false))) { e = j; if (rule === 'bland') break; }
    }
    if (e < 0) return { status: 'optimal', x: point(), value: T[m][n + m], pivots };
    let l = -1; let best = Infinity;
    for (let i = 0; i < m; i++) {
      if (T[i][e] > EPS) {
        const r = T[i][n + m] / T[i][e];
        if (r < best - EPS || (Math.abs(r - best) <= EPS && basis[i] < basis[l])) { best = r; l = i; }
      }
    }
    if (l < 0) return { status: 'unbounded', x: point(), value: Infinity, pivots };
    const pv = T[l][e];
    T[l] = T[l].map((v) => v / pv);
    for (let i = 0; i <= m; i++) {
      if (i === l) continue;
      const f = T[i][e];
      if (f) T[i] = T[i].map((v, j) => v - f * T[l][j]);
    }
    basis[l] = e;
    pivots.push({ enter: e, leave: l, T: T.map((r) => r.slice()), basis: basis.slice(), x: point(), value: T[m][n + m] });
    const key = basis.slice().sort((p, q) => p - q).join(',');
    if (seen.has(key)) return { status: 'cycling', x: point(), value: T[m][n + m], pivots };
    seen.add(key);
  }
  return { status: 'pivot-limit', x: point(), value: T[m][n + m], pivots };
}

/** Vertices of { x >= 0, A x <= b } in the plane, in order around the region. */
export function polygon(A: Mat, b: number[]): XY[] {
  const lines = [...A.map((r, i) => [r[0], r[1], b[i]]), [-1, 0, 0], [0, -1, 0]];
  const pts: XY[] = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const [a1, b1, c1] = lines[i]; const [a2, b2, c2] = lines[j];
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-12) continue;
    const x = (c1 * b2 - c2 * b1) / det; const y = (a1 * c2 - a2 * c1) / det;
    if (x < -1e-9 || y < -1e-9) continue;
    if (A.every((r, k) => r[0] * x + r[1] * y <= b[k] + 1e-9)) pts.push([x, y]);
  }
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length; const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
}

export function problem(seed: number, m: number): { A: Mat; b: number[]; c: number[] } {
  const rnd = mulberry32(seed);
  const A: Mat = []; const b: number[] = [];
  for (let i = 0; i < m; i++) {
    const th = 0.08 + ((Math.PI / 2 - 0.16) * (i + rnd())) / m;
    A.push([Math.cos(th), Math.sin(th)]);
    b.push(0.75 + 0.25 * rnd());
  }
  const ph = 0.15 + rnd() * (Math.PI / 2 - 0.3);
  return { A, b, c: [Math.cos(ph), Math.sin(ph)] };
}

/** What a reader is told about how the method stopped. */
export function outcome(lp: LP): string {
  const k = int(lp.pivots.length - 1);
  switch (lp.status) {
    case 'optimal': return `optimal after ${k} pivots: no reduced cost improves`;
    case 'unbounded': return `unbounded after ${k} pivots: the entering column has no positive entry`;
    case 'cycling': return `cycling: pivot ${k} returned to a basis already visited, with no optimum`;
    default: return `stopped at the pivot limit (${k}) without an optimum`;
  }
}

export const kernel: NumericKernel = {
  params: [
    { kind: 'range', key: 'constraints', label: 'Constraints', min: 3, max: 24, step: 1, value: 12, rebuild: true },
    { kind: 'select', key: 'rule', label: 'Entering variable', value: 'bland', rebuild: true,
      options: [{ value: 'bland', label: "Bland's rule (first improving)" }, { value: 'dantzig', label: "Dantzig's rule (largest improvement)" }] },
  ],
  rate: 0.8,
  run({ seed, params }) {
    const m = Number(params.constraints ?? 12);
    const rule = params.rule === 'dantzig' ? 'dantzig' : 'bland';
    const { A, b, c } = problem(seed, m);
    const lp = simplex(A, b, c, rule);
    const other = simplex(A, b, c, rule === 'bland' ? 'dantzig' : 'bland');
    const poly = polygon(A, b);
    const enumerated = Math.max(...poly.map(([x, y]) => c[0] * x + c[1] * y));
    const lim = 1.15 * Math.max(...poly.flat());
    const segs = A.map((r, i): [number, number, number, number] => {
      // the line r·x = b clipped to the view's first quadrant
      return [0, b[i] / r[1], b[i] / r[0], 0];
    });
    const path: XY[] = lp.pivots.map((q) => [q.x[0], q.x[1]]);
    const values: XY[] = lp.pivots.map((q, k) => [k, q.value]);
    const steps = lp.pivots.map((q, k) => {
      const v = q.value;
      // the objective's level line through the current vertex
      const level: [number, number, number, number] = [-lim, (v + c[0] * lim) / c[1], 2 * lim, (v - 2 * lim * c[0]) / c[1]];
      const rows = q.T.length; const cols = q.T[0].length;
      const tv = q.T.flat();
      const tm = Math.max(...tv.map(Math.abs), 1e-9);
      const layers: Layer[] = [
        { kind: 'polygon', pts: poly, tone: 0.65, alpha: 0.3 },
        { kind: 'segments', segs, alpha: 0.35 },
        { kind: 'segments', segs: [level], tone: 0.1, alpha: 0.9, weight: 1.5 },
        { kind: 'curve', pts: path, n: k + 1, tone: 0.9, weight: 3 },
        { kind: 'points', pts: path, n: k + 1, size: 8, tone: 0.9 },
        { kind: 'grid', panel: 1, rows, cols, values: tv.map((t) => Math.sign(t) * Math.sqrt(Math.abs(t) / tm)), lo: -1, hi: 1, clear: 0 },
      ];
      if (q.enter >= 0) layers.push({ kind: 'rects', panel: 1, rects: [[q.enter, rows - q.leave - 1, 1, 1, -1]], outline: true });
      const names = (j: number) => (j < 2 ? `x${j + 1}` : `s${j - 1}`);
      return {
        layers,
        stats: [
          { label: 'Pivot', value: k ? `${int(k)}: ${names(q.enter)} enters, row ${q.leave + 1} leaves` : 'start at the origin (slack basis)' },
          { label: 'Vertex', value: `(${fmt(q.x[0])}, ${fmt(q.x[1])})` },
          { label: 'Objective', value: fmt(v, 8) },
          { label: 'Basis', value: q.basis.map(names).join(', ') },
          { label: 'Best vertex by enumeration', value: `${fmt(enumerated, 8)} over ${int(poly.length)} vertices` },
          { label: 'Pivots, this rule / the other', value: `${int(lp.pivots.length - 1)} / ${int(other.pivots.length - 1)}` },
          { label: 'Outcome', value: k === lp.pivots.length - 1 ? outcome(lp) : 'pivoting' },
        ],
      };
    });
    return {
      panels: [
        { title: 'Feasible region and the path of vertices', x: [0, lim], y: [0, lim], equal: true, weight: 1.2 },
        { title: 'Tableau [A | I | b], objective row last', x: [0, 2 + m + 1], y: [0, m + 1], equal: true },
      ],
      steps,
      chart: { title: 'Objective at each pivot', x: { label: 'pivot' }, y: { label: 'c · x' }, series: [{ name: rule === 'bland' ? 'Bland' : 'Dantzig', points: values }] },
    };
  },
};
