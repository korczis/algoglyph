// Euclid's algorithm by repeated division, drawn as the classic tiling: each division step
// cuts q squares of side b from an a × b rectangle, and the square left over at the end has
// side gcd(a, b). The extended form carries the Bezout coefficients along.
import { mulberry32 } from '../../core/random';
import { fmt, int, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';

export interface Division { a: number; b: number; q: number; r: number }

export function divisions(a: number, b: number): Division[] {
  const out: Division[] = [];
  while (b) { const q = Math.floor(a / b); const r = a - q * b; out.push({ a, b, q, r }); a = b; b = r; }
  return out;
}

export function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** [g, x, y] with a x + b y = g. */
export function extended(a: number, b: number): [number, number, number] {
  let [r0, r1, x0, x1, y0, y1] = [a, b, 1, 0, 0, 1];
  while (r1) {
    const q = Math.floor(r0 / r1);
    [r0, r1] = [r1, r0 - q * r1];
    [x0, x1] = [x1, x0 - q * x1];
    [y0, y1] = [y1, y0 - q * y1];
  }
  return [r0, x0, y0];
}

/** Strips drawn with the cuts between their squares; past this they are solid. */
export const MAX_CUTS = 64;

/**
 * One rectangle per division step [x, y, w, h, tone]: the q squares of side b it cuts from the
 * a × b rectangle, laid along the long side of what remains, alternating direction.
 */
export function tiling(divs: Division[]): [number, number, number, number, number][] {
  const out: [number, number, number, number, number][] = [];
  let rx = 0; let ry = 0; let horizontal = true;
  divs.forEach((d, k) => {
    const len = d.q * d.b;
    const tone = (k % 6) / 6 + 0.08;
    if (horizontal) { out.push([rx, ry, len, d.b, tone]); rx += len; } else { out.push([rx, ry, d.b, len, tone]); ry += len; }
    horizontal = !horizontal;
  });
  return out;
}

export const fibonacci = (k: number) => { let [a, b] = [1, 1]; for (let i = 2; i < k; i++) [a, b] = [b, a + b]; return k < 2 ? 1 : b; };

export const kernel: NumericKernel = {
  params: [
    { kind: 'select', key: 'pair', label: 'Inputs', value: 'random', rebuild: true,
      options: [{ value: 'random', label: 'Random pair' }, { value: 'common', label: 'Random pair with a common factor' }, { value: 'fibonacci', label: 'Consecutive Fibonacci numbers' }] },
    { kind: 'range', key: 'digits', label: 'Digits', min: 2, max: 7, step: 1, value: 4, rebuild: true },
  ],
  rate: 1.2,
  aspect: 16 / 9,
  run({ seed, params }) {
    const rnd = mulberry32(seed);
    const digits = Number(params.digits ?? 4);
    const hi = 10 ** digits;
    let a: number; let b: number;
    if (params.pair === 'fibonacci') {
      let k = 2;
      while (fibonacci(k + 1) < hi) k++;
      a = fibonacci(k); b = fibonacci(k - 1);
    } else {
      a = Math.floor(hi / 10 + rnd() * (hi - hi / 10));
      b = Math.floor(hi / 10 + rnd() * (a - hi / 10));
      if (params.pair === 'common') {
        const f = 2 + Math.floor(rnd() * Math.sqrt(hi) / 2);
        a = Math.max(f, Math.floor(a / f) * f); b = Math.max(f, Math.floor(b / f) * f);
        if (b > a) [a, b] = [b, a];
      }
      if (b === a) b = Math.max(1, a - 1);
    }
    const divs = divisions(a, b);
    const [g, x, y] = extended(a, b);
    // the tiling: each division cuts a strip of q squares of side b along the long side of what
    // remains, drawn as one rectangle; the cuts between its squares are drawn while they are few
    // enough to see (a quotient in the thousands is a solid strip at any canvas size)
    const strips = tiling(divs);
    const after: number[] = []; const cuts: [number, number, number, number][] = [];
    strips.forEach(([x0, y0, w, h], k) => {
      const { q, b: side } = divs[k];
      if (q <= MAX_CUTS) {
        for (let i = 1; i < q; i++) {
          if (w > h) cuts.push([x0 + i * side, y0, x0 + i * side, y0 + h]);
          else cuts.push([x0, y0 + i * side, x0 + w, y0 + i * side]);
        }
      }
      after.push(cuts.length);
    });
    const avg: XY[] = []; const fib: XY[] = []; const lame: XY[] = [];
    const r2 = mulberry32(seed ^ 0x5bd1e995);
    for (let d = 1; d <= 9; d++) {
      let s = 0;
      for (let t = 0; t < 200; t++) {
        const p = 1 + Math.floor(r2() * 10 ** d); const q = 1 + Math.floor(r2() * 10 ** d);
        s += divisions(Math.max(p, q), Math.min(p, q)).length;
      }
      avg.push([d, s / 200]);
      let k = 2;
      while (fibonacci(k + 1) < 10 ** d) k++;
      fib.push([d, divisions(fibonacci(k), fibonacci(k - 1)).length]);
      lame.push([d, 5 * d]);
    }
    const chart = {
      title: 'Division steps against input size', x: { label: 'decimal digits' }, y: { label: 'division steps' },
      series: [{ name: 'Random pairs, mean', points: avg }, { name: 'Fibonacci pairs', points: fib }, { name: 'Lamé bound 5d', points: lame }],
    };
    const qmax = Math.max(...divs.map((d) => d.q));
    const steps = divs.map((d, k) => {
      const shown = strips.slice(0, k + 1);
      const layers: Layer[] = [
        { kind: 'rects', rects: [[0, 0, a, b, -1]], alpha: 0.08 },
        { kind: 'rects', rects: shown, alpha: 0.85 },
        { kind: 'rects', rects: shown.map((s) => [s[0], s[1], s[2], s[3], -1] as [number, number, number, number, number]), outline: true, alpha: 0.35 },
        { kind: 'segments', segs: cuts.slice(0, after[k]), alpha: 0.35 },
        { kind: 'rects', panel: 1, rects: divs.slice(0, k + 1).map((t, i) => [i + 0.1, 0, 0.8, Math.log2(1 + t.q), i === k ? 0.85 : 0.3] as [number, number, number, number, number]) },
      ];
      return {
        layers,
        stats: [
          { label: 'Division', value: `${int(d.a)} = ${int(d.q)} × ${int(d.b)} + ${int(d.r)}` },
          { label: 'Steps', value: `${k + 1} of ${divs.length} (Lamé bound ${5 * String(b).length})` },
          { label: 'Continued fraction a / b', value: `[${divs.slice(0, k + 1).map((t) => t.q).join('; ')}${k + 1 < divs.length ? '; …' : ''}]` },
          { label: 'gcd', value: k + 1 === divs.length ? `${int(g)}, the side of the last square` : 'pending' },
          { label: 'Bezout', value: `${int(a)} · ${fmt(x)} + ${int(b)} · ${fmt(y)} = ${fmt(a * x + b * y)}` },
        ],
      };
    });
    return {
      panels: [
        { title: `${int(a)} × ${int(b)}, cut into squares`, x: [0, a], y: [0, b], equal: true, weight: 1.7 },
        { title: 'Quotients (log₂(1 + q))', x: [0, Math.max(8, divs.length)], y: [0, Math.log2(1 + qmax) * 1.05] },
      ],
      steps,
      chart,
    };
  },
};
