// Square roots and logarithms to two hundred digits, in exact integer arithmetic (BigInt fixed
// point). Roots: Newton's iteration, the secant method and bisection on x² = a, each iterate's
// correct digits measured against a reference root found digit by digit, the pencil method,
// which none of them uses. Logarithms: Feynman's ladder of square roots of 10 (Lectures I, ch. 22),
// one bit of log₁₀ a a rung, with his first-order correction, against an atanh series.
import type { Chart, SelectParam } from '../../core/plate';
import { fitLine, fmt, int, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';

/** Decimal digits carried by the root finders. */
export const ROOT_DIGITS = 200;
/** Decimal digits carried by the ladder. */
export const LADDER_DIGITS = 120;
/** Iterations shown for the root finders. */
export const ITERATIONS = 14;
/** Bisection steps behind its measured rate (one bit each, about 120 digits). */
export const BISECTION_STEPS = 400;
/** Rungs of the ladder: bits of log₁₀ a. */
export const RUNGS = 60;

const TEN = 10n;
export const scale = (digits: number) => TEN ** BigInt(digits);

/** ⌊√N⌋ by the pencil method: two decimal digits of N at a time, one digit of the root. */
export function pencilSqrt(N: bigint): bigint {
  if (N < 0n) throw new RangeError('no real square root');
  const s = N.toString();
  const pairs = s.length % 2 ? `0${s}` : s;
  let root = 0n; let rem = 0n;
  for (let i = 0; i < pairs.length; i += 2) {
    rem = rem * 100n + BigInt(pairs.slice(i, i + 2));
    let d = 9n;
    while ((20n * root + d) * d > rem) d--;
    rem -= (20n * root + d) * d;
    root = root * 10n + d;
  }
  return root;
}

/** log₁₀ of a positive BigInt, to double precision. */
export function log10Big(e: bigint): number {
  const s = (e < 0n ? -e : e).toString();
  const lead = Number(s.slice(0, 15));
  return Math.log10(lead) + (s.length - Math.min(15, s.length));
}

/** Correct significant digits of x against ref (both fixed point on one scale), capped at `cap`. */
export function correctDigits(x: bigint, ref: bigint, cap: number): number {
  const e = x > ref ? x - ref : ref - x;
  if (e === 0n) return cap;
  return Math.max(0, Math.min(cap, log10Big(ref) - log10Big(e)));
}

export interface RootRun { newton: bigint[]; secant: bigint[]; bisection: bigint[]; ref: bigint; S: bigint }

/** Newton, secant and bisection on x² = a in fixed point, from x = 1 (and a, for the secant and the bracket). */
export function roots(a: number, digits = ROOT_DIGITS, iterations = ITERATIONS, bisectionSteps = BISECTION_STEPS): RootRun {
  const S = scale(digits);
  const A = BigInt(a) * S;
  const target = A * S; // x² = a, as X² = A·S for X = x·S
  const ref = pencilSqrt(target);
  const newton = [S];
  for (let k = 0; k < iterations; k++) { const x = newton[k]; newton.push((x + target / x) / 2n); }
  const secant = [S, A];
  const g = (x: bigint) => x * x - target;
  while (secant.length < iterations + 1) {
    const [x0, x1] = secant.slice(-2);
    const d = g(x1) - g(x0);
    secant.push(d === 0n ? x1 : x1 - (g(x1) * (x1 - x0)) / d);
  }
  let lo = S; let hi = A;
  const bisection = [lo];
  for (let k = 0; k < bisectionSteps; k++) {
    const m = (lo + hi) / 2n;
    if (m * m <= target) lo = m; else hi = m;
    bisection.push(lo);
  }
  return { newton, secant, bisection, ref, S };
}

/**
 * The ratio of correct digits from one iterate to the next, log|eₖ₊₁| / log|eₖ|: the order of
 * convergence. Read at the last pair still clear of the start (at least 5 digits) and of the
 * precision carried (at most 90% of it).
 */
export function digitRatio(digits: number[], cap: number): number {
  let r = NaN;
  for (let k = 0; k + 1 < digits.length; k++) {
    if (digits[k] >= 5 && digits[k + 1] <= 0.9 * cap) r = digits[k + 1] / digits[k];
  }
  return r;
}

/** ln x for x ≥ 1 in fixed point: x = 2ᵐ·u, u in [1, 2), each logarithm by atanh's series 2Σy²ʲ⁺¹/(2j + 1). */
export function lnFixed(X: bigint, S: bigint): bigint {
  const atanhSeries = (num: bigint, den: bigint) => {
    // 2·atanh(num/den) for |num/den| ≤ 1/3
    const y = (num * S) / den;
    const y2 = (y * y) / S;
    let term = y; let sum = 0n;
    for (let j = 1n; term !== 0n; j += 2n) { sum += term / j; term = (term * y2) / S; }
    return 2n * sum;
  };
  const ln2 = atanhSeries(1n, 3n);
  let m = 0n; let u = X;
  while (u >= 2n * S) { u /= 2n; m++; }
  return m * ln2 + atanhSeries(u - S, u + S);
}

export interface Rung { k: number; r: bigint; bit: 0 | 1; sum: bigint; corrected: bigint; ln10: bigint }

/** Feynman's ladder for log₁₀ a, a in (1, 10): rᵏ = 10^(1/2ᵏ) by successive square roots. */
export function ladder(a: number, digits = LADDER_DIGITS, rungs = RUNGS): { rungs: Rung[]; ref: bigint; ln10: bigint; S: bigint } {
  const S = scale(digits);
  const ln10 = lnFixed(10n * S, S);
  const ref = (lnFixed(BigInt(a) * S, S) * S) / ln10;
  let r = 10n * S;
  let x = BigInt(a) * S;
  let sum = 0n;
  const out: Rung[] = [];
  for (let k = 1; k <= rungs; k++) {
    r = pencilSqrt(r * S);
    const bit = x >= r ? 1 : 0;
    if (bit) { x = (x * S) / r; sum += S / 2n ** BigInt(k); }
    // ln 10 from the ladder itself, 2ᵏ(10^(1/2ᵏ) − 1), and the remainder log₁₀(1 + δ) ≈ δ / ln 10
    const l = 2n ** BigInt(k) * (r - S);
    out.push({ k, r, bit, sum, corrected: sum + ((x - S) * S) / l, ln10: l });
  }
  return { rungs: out, ref, ln10, S };
}

/** The first `n` significant decimals of a fixed-point value with `digits` places. */
export function decimals(X: bigint, digits: number, n: number): string {
  const s = X.toString().padStart(digits + 1, '0');
  const int = s.slice(0, s.length - digits);
  return `${int}.${s.slice(s.length - digits).slice(0, n)}`;
}

/** The slope of y against x: digits gained per step. */
const rate = (pts: XY[]) => fitLine(pts)[0];

export const experimentParam = (): SelectParam => ({
  kind: 'select', key: 'experiment', label: 'Experiment', value: 'roots', rebuild: true,
  options: [
    { value: 'roots', label: 'Square root: Newton, secant, bisection' },
    { value: 'ladder', label: 'Logarithm: Feynman’s ladder of square roots' },
  ],
});

export const numberParam = (): SelectParam => ({
  kind: 'select', key: 'a', label: 'Number a', value: '2', rebuild: true,
  options: [{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '7', label: '7' }],
});

const numberOf = (v: unknown) => ([2, 3, 7].includes(Number(v)) ? Number(v) : 2);

function rootsRun(a: number) {
  const run = roots(a);
  const D = ROOT_DIGITS;
  const dig = (xs: bigint[]) => xs.map((x) => correctDigits(x, run.ref, D));
  const dn = dig(run.newton); const ds = dig(run.secant); const db = dig(run.bisection);
  const rN = digitRatio(dn, D); const rS = digitRatio(ds, D);
  const bisRate = rate(db.map((d, k) => [k, d] as XY).filter(([k]) => k >= 20));
  const panels = [
    { title: `Correct digits of √${a}, iteration by iteration`, x: [0, ITERATIONS] as [number, number], y: [0, D * 1.05] as [number, number], axes: true },
    { title: 'The iterates, first 48 decimals', x: [0, 1] as [number, number], y: [0, 5] as [number, number] },
  ];
  const methods = [
    { name: 'Newton', d: dn, x: run.newton, tone: 0.85 },
    { name: 'Secant', d: ds, x: run.secant, tone: 0.5 },
    { name: 'Bisection', d: db, x: run.bisection, tone: 0.15 },
  ];
  const steps = Array.from({ length: ITERATIONS + 1 }, (_, k) => {
    const layers: Layer[] = [];
    for (const m of methods) {
      const pts = m.d.slice(0, k + 1).map((d, i) => [i, d] as XY);
      layers.push({ kind: 'curve', pts, tone: m.tone, weight: 2 });
      layers.push({ kind: 'points', pts, tone: m.tone, size: 5 });
    }
    methods.forEach((m, i) => layers.push({
      kind: 'text', panel: 1, x: 0.02, y: 4.3 - i * 1.1, align: 'left', tone: m.tone,
      text: `${m.name.padEnd(10)} ${decimals(m.x[k], D, 48)}  (${int(Math.floor(m.d[k]))} digits)`,
    }));
    layers.push({ kind: 'text', panel: 1, x: 0.02, y: 0.6, align: 'left', text: `Reference  ${decimals(run.ref, D, 48)}  (pencil method)` });
    const chart: Chart = {
      title: 'Correct digits against iterations', x: { label: 'iteration' }, y: { label: 'correct digits' },
      series: methods.map((m) => ({ name: m.name, points: m.d.slice(0, k + 1).map((d, i) => [i, d] as XY) })),
    };
    return {
      layers,
      chart,
      stats: [
        { label: 'Iteration', value: int(k) },
        { label: 'Newton, correct digits', value: fmt(dn[k], 4) },
        { label: 'Secant, correct digits', value: fmt(ds[k], 4) },
        { label: 'Bisection, correct digits', value: fmt(db[k], 4) },
        { label: 'Newton, digit ratio per iteration', value: Number.isFinite(rN) ? fmt(rN, 4) : 'not reached' },
        { label: 'Secant, digit ratio per iteration', value: Number.isFinite(rS) ? fmt(rS, 4) : 'not reached' },
        { label: 'Golden ratio (1 + √5)/2, the secant’s order', value: fmt((1 + Math.sqrt(5)) / 2, 6) },
        { label: `Bisection, digits per step over ${int(BISECTION_STEPS)} steps`, value: fmt(bisRate, 4) },
        { label: 'One bit in decimal digits, log₁₀ 2', value: fmt(Math.log10(2), 6) },
        { label: 'Newton’s last iterate against the reference, digits', value: fmt(dn[ITERATIONS], 4) },
        { label: 'Reference: r² ≤ a·10^(2D) < (r + 1)², r the pencil root', value: run.ref * run.ref <= BigInt(a) * run.S * run.S && (run.ref + 1n) ** 2n > BigInt(a) * run.S * run.S ? '1 (holds)' : '0 (fails)' },
        { label: 'Digits carried', value: int(D) },
      ],
    };
  });
  return { panels, steps };
}

function ladderRun(a: number) {
  const { rungs, ref, ln10 } = ladder(a);
  const D = LADDER_DIGITS;
  const d1 = rungs.map((q) => correctDigits(q.sum, ref, D));
  const d2 = rungs.map((q) => correctDigits(q.corrected, ref, D));
  const eL = rungs.map((q) => (q.ln10 > ln10 ? q.ln10 - ln10 : ln10 - q.ln10));
  const plainRate = rate(d1.map((d, i) => [i + 1, d] as XY).filter(([k]) => k >= 5));
  const corrRate = rate(d2.map((d, i) => [i + 1, d] as XY).filter(([k]) => k >= 5));
  const lnRatio = Number((eL[RUNGS - 2] * 1000000n) / eL[RUNGS - 1]) / 1e6;
  const viaFloat = Number(decimals(rungs[RUNGS - 1].corrected, D, 17));
  const panels = [
    { title: 'The ladder: 10^(1/2ᵏ), and the bit of log₁₀ a it decides', x: [0, 1] as [number, number], y: [0, 13] as [number, number], weight: 1.3 },
    { title: 'Correct digits of log₁₀ a, rung by rung', x: [0, RUNGS] as [number, number], y: [0, 45] as [number, number], axes: true },
  ];
  const steps = rungs.map((q, k) => {
    const layers: Layer[] = [];
    const from = Math.max(0, k - 11);
    for (let i = from; i <= k; i++) {
      const r = rungs[i];
      layers.push({
        kind: 'text', x: 0.02, y: 12.2 - (i - from), align: 'left', tone: r.bit ? 0.85 : -1,
        text: `k = ${String(r.k).padStart(2)}   10^(1/2^${r.k}) = ${decimals(r.r, D, 20)}   bit ${r.bit}`,
      });
    }
    const pts1 = d1.slice(0, k + 1).map((d, i) => [i + 1, d] as XY);
    const pts2 = d2.slice(0, k + 1).map((d, i) => [i + 1, d] as XY);
    layers.push({ kind: 'curve', panel: 1, pts: pts1, tone: 0.2, weight: 2 });
    layers.push({ kind: 'curve', panel: 1, pts: pts2, tone: 0.85, weight: 2 });
    const chart: Chart = {
      title: 'Correct digits of log₁₀ a against rungs', x: { label: 'rung k' }, y: { label: 'correct digits' },
      series: [{ name: 'bits alone', points: pts1 }, { name: 'with δ / ln 10', points: pts2 }],
    };
    return {
      layers,
      chart,
      stats: [
        { label: 'Rung k', value: int(q.k) },
        { label: 'log₁₀ a from the bits so far', value: decimals(q.sum, D, 24) },
        { label: 'log₁₀ a with the correction δ / ln 10', value: decimals(q.corrected, D, 24) },
        { label: 'log₁₀ a by the atanh series (reference)', value: decimals(ref, D, 24) },
        { label: 'Bits alone, correct digits', value: fmt(d1[k], 4) },
        { label: 'With the correction, correct digits', value: fmt(d2[k], 4) },
        { label: 'Bits alone, digits per rung', value: fmt(plainRate, 4) },
        { label: 'With the correction, digits per rung', value: fmt(corrRate, 4) },
        { label: '2ᵏ(10^(1/2ᵏ) − 1), toward ln 10', value: decimals(q.ln10, D, 24) },
        { label: 'ln 10 from the ladder, error ratio per rung at the last rung', value: fmt(lnRatio, 6) },
        { label: 'log₁₀ a at the last rung minus Math.log10 a, in double precision', value: fmt(Math.abs(viaFloat - Math.log10(a))) },
        { label: 'Digits carried', value: int(D) },
      ],
    };
  });
  return { panels, steps };
}

export const kernel: NumericKernel = {
  params: [experimentParam(), numberParam()],
  thumb: 0.6,
  run({ params }) {
    const a = numberOf(params.a);
    return params.experiment === 'ladder' ? ladderRun(a) : rootsRun(a);
  },
};
