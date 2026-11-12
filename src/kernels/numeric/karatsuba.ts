// Karatsuba's divide and conquer for polynomial products: three half-size products, (a0 b0),
// (a1 b1) and (a0 + a1)(b0 + b1), instead of four. With base-10 digits as coefficients the
// product is also the product of two integers, checked after carrying.
import { mulberry32 } from '../../core/random';
import { fmt, int, logSlope, Meter, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';

export interface Call { depth: number; at: number; width: number; size: number; out: number[] }

/** Schoolbook convolution: n·m multiplications. */
export function schoolbook(a: number[], b: number[], m = new Meter()): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] = m.add(out[i + j], m.mul(a[i], b[j]));
  return out;
}

/** The product of two coefficient arrays of any lengths (zero-padded to a power of two). */
export function karatsuba(a: number[], b: number[], m = new Meter(), calls?: Call[]): number[] {
  const len = a.length + b.length - 1;
  let n = 1;
  while (n < Math.max(a.length, b.length)) n *= 2;
  const pad = (x: number[]) => [...x, ...new Array<number>(n - x.length).fill(0)];
  const rec = (x: number[], y: number[], depth: number, at: number, width: number): number[] => {
    const s = x.length;
    let out: number[];
    if (s === 1) out = [m.mul(x[0], y[0])];
    else {
      const h = s / 2;
      const [x0, x1, y0, y1] = [x.slice(0, h), x.slice(h), y.slice(0, h), y.slice(h)];
      const w = width / 3;
      const p0 = rec(x0, y0, depth + 1, at, w);
      const p2 = rec(x1, y1, depth + 1, at + w, w);
      const p1 = rec(x0.map((v, i) => m.add(v, x1[i])), y0.map((v, i) => m.add(v, y1[i])), depth + 1, at + 2 * w, w);
      out = new Array<number>(2 * s - 1).fill(0);
      for (let i = 0; i < p0.length; i++) {
        out[i] = m.add(out[i], p0[i]);
        out[i + s] = m.add(out[i + s], p2[i]);
        out[i + h] = m.add(out[i + h], m.sub(m.sub(p1[i], p0[i]), p2[i]));
      }
    }
    calls?.push({ depth, at, width, size: s, out });
    return out;
  };
  return rec(pad(a), pad(b), 0, 0, 1).slice(0, len);
}

/** Digits (least significant first) times digits, carried into a decimal string. */
export function carry(c: number[]): string {
  const d: number[] = [];
  let k = 0;
  for (let i = 0; i < c.length || k; i++) {
    const v = (c[i] ?? 0) + k;
    d.push(((v % 10) + 10) % 10);
    k = Math.floor(v / 10);
  }
  while (d.length > 1 && d[d.length - 1] === 0) d.pop();
  return d.reverse().join('');
}

const SIZES = [1, 2, 4, 8, 16, 32, 64, 128, 256];

let cached: ReturnType<typeof measureCounts> | undefined;

/** Measured once per page: the counts do not depend on the input. */
export const counts = () => (cached ??= measureCounts());

function measureCounts(): { k: XY[]; s: XY[] } {
  const k: XY[] = []; const s: XY[] = [];
  for (const n of SIZES) {
    const x = new Array<number>(n).fill(1);
    const mk = new Meter(); const ms = new Meter();
    karatsuba(x, x, mk);
    schoolbook(x, x, ms);
    k.push([n, mk.get('mul')]);
    s.push([n, ms.get('mul')]);
  }
  return { k, s };
}

export const kernel: NumericKernel = {
  params: [{ kind: 'select', key: 'n', label: 'Coefficients per factor', value: '32', rebuild: true,
    options: ['4', '8', '16', '32', '64'].map((v) => ({ value: v, label: v })) }],
  run({ seed, params }) {
    const rnd = mulberry32(seed);
    const n = Number(params.n ?? 32);
    const a = Array.from({ length: n }, () => Math.floor(rnd() * 10));
    const b = Array.from({ length: n }, () => Math.floor(rnd() * 10));
    a[n - 1] ||= 1; b[n - 1] ||= 1;
    const calls: Call[] = [];
    const m = new Meter();
    const c = karatsuba(a, b, m, calls);
    const school = new Meter();
    schoolbook(a, b, school);
    const A = a.slice().reverse().join(''); const B = b.slice().reverse().join('');
    const ok = carry(c) === (BigInt(A) * BigInt(B)).toString();
    const depth = Math.log2(n);
    const { k: kc, s: sc } = counts();
    const chart = {
      title: 'Multiplications against size', x: { label: 'coefficients n', log: true }, y: { label: 'multiplications', log: true },
      series: [{ name: 'Karatsuba', points: kc }, { name: 'Schoolbook', points: sc }],
    };
    const per = Math.max(1, Math.ceil(calls.length / 180));
    const steps = [];
    let leaves = 0;
    for (let k = 0; k < calls.length; k += per) {
      const upto = Math.min(calls.length, k + per);
      for (let i = k; i < upto; i++) if (calls[i].size === 1) leaves++;
      const cur = calls[upto - 1];
      const cmax = Math.max(1, ...cur.out);
      const layers: Layer[] = [
        { kind: 'rects', rects: calls.slice(0, upto).map((q) => [q.at, -q.depth - 1, q.width, 0.86, q.depth / Math.max(1, depth)] as [number, number, number, number, number]), alpha: 0.9 },
        { kind: 'rects', rects: [[cur.at, -cur.depth - 1, cur.width, 0.86, -1]], outline: true },
        { kind: 'rects', panel: 1, rects: cur.out.map((v, i) => [i * (2 * n - 1) / cur.out.length, 0, 0.8 * (2 * n - 1) / cur.out.length, v / cmax, 0.25] as [number, number, number, number, number]) },
      ];
      steps.push({
        layers,
        stats: [
          { label: 'Factors', value: `${n} digits each` },
          { label: 'Multiplications', value: `${int(leaves)} of ${int(m.get('mul'))} (schoolbook ${int(school.get('mul'))})` },
          { label: 'Additions', value: int(m.get('add')) },
          { label: 'Measured growth', value: `Karatsuba n^${fmt(logSlope(kc), 3)}, schoolbook n^${fmt(logSlope(sc), 3)}` },
          { label: 'As integers', value: upto === calls.length ? (ok ? 'product verified against BigInt' : 'MISMATCH') : 'pending' },
        ],
      });
    }
    return {
      panels: [
        { title: 'Recursion: three products per call', x: [0, 1], y: [-depth - 1.1, 0.1], weight: 1.6 },
        { title: 'Coefficients of the product just finished', x: [0, 2 * n - 1], y: [0, 1.05] },
      ],
      steps,
      chart,
    };
  },
};
