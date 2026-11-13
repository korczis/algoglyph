// Horner's rule against two naive evaluations of the same polynomial, every multiplication and
// addition counted by the meter; the nested partial values are the bars of the right panel.
import { mulberry32 } from '../../core/random';
import { fmt, int, Meter, span, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';

/** p(x) = a0 + a1 x + ... + an x^n by nesting: n multiplications, n additions. */
export function horner(a: number[], x: number, m = new Meter(), partial?: number[]): number {
  let v = a[a.length - 1];
  partial?.push(v);
  for (let k = a.length - 2; k >= 0; k--) {
    v = m.add(m.mul(v, x), a[k]);
    partial?.push(v);
  }
  return v;
}

/** Each power computed from scratch: x^k costs k - 1 multiplications, then one for a_k. */
export function naive(a: number[], x: number, m = new Meter()): number {
  let s = a[0];
  for (let k = 1; k < a.length; k++) {
    let p = x;
    for (let j = 1; j < k; j++) p = m.mul(p, x);
    s = m.add(s, m.mul(a[k], p));
  }
  return s;
}

/** Powers carried along: 2n - 1 multiplications. */
export function runningPowers(a: number[], x: number, m = new Meter()): number {
  let s = a[0];
  let p = 1;
  for (let k = 1; k < a.length; k++) {
    p = k === 1 ? x : m.mul(p, x);
    s = m.add(s, m.mul(a[k], p));
  }
  return s;
}

const muls = (f: (a: number[], x: number, m: Meter) => number, d: number) => {
  const m = new Meter();
  f(Array.from({ length: d + 1 }, (_, i) => i + 1), 0.5, m);
  return m.get('mul');
};

const POINTS = 48;

export const kernel: NumericKernel = {
  params: [{ kind: 'range', key: 'degree', label: 'Degree n', min: 2, max: 16, step: 1, value: 9, rebuild: true }],
  thumb: 0.65,
  run({ seed, params }) {
    const rnd = mulberry32(seed);
    const d = Number(params.degree ?? 9);
    // roots spread over [-1, 1] keep the curve inside the panel and give it n turns
    const roots = Array.from({ length: d }, (_, i) => -0.95 + (1.9 * (i + 0.2 + 0.6 * rnd())) / d);
    let a = [1];
    for (const r of roots) {
      const next = new Array<number>(a.length + 1).fill(0);
      a.forEach((c, i) => { next[i + 1] += c; next[i] -= r * c; });
      a = next;
    }
    const scale = 1 / Math.max(...Array.from({ length: 201 }, (_, i) => Math.abs(horner(a, -1 + i / 100))));
    a = a.map((c) => c * scale);
    const xs = Array.from({ length: POINTS + 1 }, (_, i) => -1 + (2 * i) / POINTS);
    const ys = xs.map((x) => horner(a, x));
    const yr = span(ys, 0.15);
    const totals = { h: 0, n: 0, r: 0 };
    let drift = 0;
    const chart = {
      title: 'Multiplications for one evaluation',
      x: { label: 'degree n' }, y: { label: 'multiplications', log: true },
      series: [
        { name: 'Horner', points: Array.from({ length: 16 }, (_, i) => [i + 1, muls(horner, i + 1)] as XY) },
        { name: 'Running powers', points: Array.from({ length: 16 }, (_, i) => [i + 1, muls(runningPowers, i + 1)] as XY) },
        { name: 'Powers from scratch', points: Array.from({ length: 16 }, (_, i) => [i + 1, muls(naive, i + 1)] as XY) },
      ],
    };
    const steps = xs.map((x, j) => {
      const mh = new Meter(); const mn = new Meter(); const mr = new Meter();
      const partial: number[] = [];
      const v = horner(a, x, mh, partial);
      const w = naive(a, x, mn);
      runningPowers(a, x, mr);
      totals.h += mh.get('mul'); totals.n += mn.get('mul'); totals.r += mr.get('mul');
      drift = Math.max(drift, Math.abs(v - w));
      const pr = span([0, ...partial]);
      const layers: Layer[] = [
        { kind: 'curve', pts: xs.map((t, i) => [t, ys[i]] as XY), n: j + 1, tone: 0.15, weight: 2.5 },
        { kind: 'points', pts: xs.map((t, i) => [t, ys[i]] as XY), n: j + 1, size: 3 },
        { kind: 'segments', segs: [[x, yr[0], x, yr[1]]], alpha: 0.3 },
        { kind: 'points', pts: [[x, v]], size: 9, tone: 0.85 },
        { kind: 'rects', panel: 1, rects: partial.map((b, k) => [k + 0.1, 0, 0.8, b / (pr[1] - pr[0] || 1), k === partial.length - 1 ? 0.85 : 0.3] as [number, number, number, number, number]) },
      ];
      return {
        layers,
        stats: [
          { label: 'x', value: fmt(x) },
          { label: 'p(x) by Horner', value: fmt(v, 10) },
          { label: 'This evaluation', value: `Horner ${mh.get('mul')} ×, running powers ${mr.get('mul')} ×, powers from scratch ${mn.get('mul')} ×` },
          { label: 'Multiplications so far', value: `${int(totals.h)} / ${int(totals.r)} / ${int(totals.n)}` },
          { label: 'Largest |Horner − naive| so far', value: fmt(drift) },
          { label: 'Additions this evaluation', value: `Horner ${mh.get('add')} +, running powers ${mr.get('add')} +, powers from scratch ${mn.get('add')} +` },
        ],
      };
    });
    return {
      panels: [
        { title: `p(x) of degree ${d}, evaluated left to right`, x: [-1, 1], y: yr, axes: true, weight: 1.5 },
        { title: 'Nested values b_n … b_0', x: [0, d + 1], y: [-1, 1], axes: true },
      ],
      steps,
      chart,
    };
  },
};
