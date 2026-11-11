// Detrended fluctuation analysis and rescaled range. DFA integrates the series into a profile,
// cuts it into boxes of n samples, removes each box's least-squares line and measures the RMS
// that remains, F(n); the slope of log F against log n is α. Rescaled range measures R/S per
// window instead and gives the Hurst exponent H. White noise: α ≈ H ≈ ½.
import { gaussian, mulberry32 } from '../../core/random';
import { fitLine, fmt, int, logSlope, span, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';

export function profile(x: number[]): number[] {
  const mean = x.reduce((a, b) => a + b, 0) / x.length;
  let s = 0;
  return x.map((v) => (s += v - mean));
}

/** F(n) of first-order DFA, with each box's fitted line for drawing. */
export function fluctuation(y: number[], n: number): { F: number; fits: [number, number, number, number][] } {
  const boxes = Math.floor(y.length / n);
  let sq = 0;
  const fits: [number, number, number, number][] = [];
  for (let b = 0; b < boxes; b++) {
    const pts: XY[] = Array.from({ length: n }, (_, i) => [b * n + i, y[b * n + i]]);
    const [k, c] = fitLine(pts);
    for (const [t, v] of pts) sq += (v - (k * t + c)) ** 2;
    fits.push([b * n, k * b * n + c, (b + 1) * n - 1, k * ((b + 1) * n - 1) + c]);
  }
  return { F: Math.sqrt(sq / (boxes * n)), fits };
}

/** Mean rescaled range R/S over non-overlapping windows of n samples. */
export function rescaledRange(x: number[], n: number): number {
  const w = Math.floor(x.length / n);
  let sum = 0; let used = 0;
  for (let b = 0; b < w; b++) {
    const seg = x.slice(b * n, (b + 1) * n);
    const mean = seg.reduce((a, v) => a + v, 0) / n;
    let z = 0; let lo = 0; let hi = 0; let ss = 0;
    for (const v of seg) { z += v - mean; lo = Math.min(lo, z); hi = Math.max(hi, z); ss += (v - mean) ** 2; }
    const sd = Math.sqrt(ss / n);
    if (sd > 0) { sum += (hi - lo) / sd; used++; }
  }
  return used ? sum / used : NaN;
}

export function boxSizes(N: number): number[] {
  const out: number[] = [];
  for (let n = 8; n <= N / 4; n = Math.ceil(n * 1.35)) out.push(n);
  return out;
}

/** Fractional Gaussian noise with Hurst exponent H, exactly, by Hosking's recursion (Durbin–Levinson). */
export function fgn(N: number, H: number, seed: number): number[] {
  const rnd = mulberry32(seed);
  const g = (k: number) => 0.5 * (Math.abs(k + 1) ** (2 * H) - 2 * Math.abs(k) ** (2 * H) + Math.abs(k - 1) ** (2 * H));
  const x = new Array<number>(N).fill(0);
  let phi = new Float64Array(N); // phi[j] holds the coefficient of x_{t-1-j}
  let next = new Float64Array(N);
  let len = 0;
  let v = 1;
  x[0] = gaussian(rnd);
  for (let t = 1; t < N; t++) {
    let num = g(t);
    for (let j = 0; j < len; j++) num -= phi[j] * g(t - 1 - j);
    const k = num / v;
    for (let j = 0; j < len; j++) next[j] = phi[j] - k * phi[len - 1 - j];
    next[len] = k;
    [phi, next] = [next, phi];
    len++;
    v *= 1 - k * k;
    let mean = 0;
    for (let j = 0; j < len; j++) mean += phi[j] * x[t - 1 - j];
    x[t] = mean + Math.sqrt(v) * gaussian(rnd);
  }
  return x;
}

export function seriesFor(kind: string, N: number, seed: number): { x: number[]; expect: string } {
  if (kind === 'walk') { const rnd = mulberry32(seed); let s = 0; return { x: Array.from({ length: N }, () => (s += gaussian(rnd))), expect: 'α ≈ 1.5 (a random walk: the profile of a profile)' }; }
  if (kind.startsWith('fgn-')) { const H = Number(kind.slice(4)); return { x: fgn(N, H, seed), expect: `α ≈ ${H} (fractional Gaussian noise, H = ${H})` }; }
  const rnd = mulberry32(seed);
  return { x: Array.from({ length: N }, () => gaussian(rnd)), expect: 'α ≈ 0.5 (independent samples)' };
}

export const kernel: NumericKernel = {
  params: [
    { kind: 'select', key: 'series', label: 'Series', value: 'fgn-0.8', rebuild: true,
      options: [{ value: 'white', label: 'White noise' }, { value: 'fgn-0.8', label: 'Persistent noise, H 0.8' },
        { value: 'fgn-0.3', label: 'Anti-persistent noise, H 0.3' }, { value: 'walk', label: 'Random walk' }] },
  ],
  rate: 1.5,
  thumb: 0.5,
  run({ seed, params }) {
    const N = 2048;
    const { x, expect } = seriesFor(String(params.series ?? 'fgn-0.8'), N, seed);
    const y = profile(x);
    const sizes = boxSizes(N);
    const dfa: XY[] = []; const rs: XY[] = [];
    const runs = sizes.map((n) => { const r = fluctuation(y, n); dfa.push([n, r.F]); rs.push([n, rescaledRange(x, n)]); return r; });
    const ly = span(y, 0.08);
    const lx = dfa.map(([n, F]) => [Math.log10(n), Math.log10(F)] as XY);
    const lr = span(lx.map((q) => q[1]), 0.15);
    const steps = sizes.map((n, k) => {
      const alpha = k ? logSlope(dfa.slice(0, k + 1)) : NaN;
      const [b, c] = k ? fitLine(lx.slice(0, k + 1)) : [NaN, NaN];
      const layers: Layer[] = [
        { kind: 'curve', pts: y.map((v, i) => [i, v] as XY), tone: 0.25, weight: 1, alpha: 0.9 },
        { kind: 'segments', segs: runs[k].fits, tone: 0.9, weight: 2 },
        { kind: 'points', panel: 1, pts: lx, n: k + 1, size: 7, tone: 0.9 },
      ];
      if (k) layers.push({ kind: 'segments', panel: 1, segs: [[lx[0][0], b * lx[0][0] + c, lx[k][0], b * lx[k][0] + c]], alpha: 0.6 });
      return {
        layers,
        stats: [
          { label: 'Box size n', value: `${int(n)} samples, ${int(Math.floor(N / n))} boxes` },
          { label: 'F(n)', value: fmt(runs[k].F) },
          { label: 'DFA exponent α so far', value: k ? fmt(alpha, 3) : 'after two sizes' },
          { label: 'Rescaled range H so far', value: k ? fmt(logSlope(rs.slice(0, k + 1)), 3) : 'after two sizes' },
          { label: 'Expected', value: expect },
        ],
        chart: {
          title: 'Fluctuation against window size', x: { label: 'window n', log: true }, y: { label: 'F(n) and R/S', log: true },
          series: [{ name: 'DFA F(n)', points: dfa.slice(0, k + 1) }, { name: 'Rescaled range R/S', points: rs.slice(0, k + 1) }],
        },
      };
    });
    return {
      panels: [
        { title: 'Profile (cumulative sum) and each box’s trend line', x: [0, N], y: ly, weight: 1.6 },
        { title: 'log₁₀ F against log₁₀ n', x: span(lx.map((q) => q[0]), 0.08), y: lr },
      ],
      steps,
    };
  },
};
