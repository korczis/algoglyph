import { num } from '../../core/plate';
import { fmt, normalCdf, normalPdf, pm, SortedSample } from '../../engines/stochastic/sample';
import { histogram, type StochasticKernel } from '../../engines/stochastic/trace';

export interface BoxMullerResult {
  z: Float64Array;
  mean: number;
  variance: number;
  ks: number;
  /** Correlation of the two values of each pair. */
  pairCorrelation: number;
}

/** Kolmogorov–Smirnov distance of an ascending sample from the standard normal. */
function ksDistance(s: ArrayLike<number>): number {
  const n = s.length;
  let d = 0;
  for (let i = 0; i < n; i++) {
    const f = normalCdf(s[i]);
    d = Math.max(d, (i + 1) / n - f, f - i / n);
  }
  return d;
}

const FRAMES = 120;
const LO = -4;
const HI = 4;
const DENSITY: [number, number][] = Array.from({ length: 81 }, (_, i) => {
  const x = LO + (i / 80) * (HI - LO);
  return [x, normalPdf(x)];
});

// Two uniforms u1, u2 become a radius sqrt(-2 ln u1) and an angle 2 pi u2; the point's two
// coordinates are two independent standard normals.
export const kernel: StochasticKernel<BoxMullerResult> = {
  palette: 'abyss',
  params: [{ kind: 'range', key: 'n', label: 'Samples', min: 2000, max: 40000, step: 1000, value: 12000, rebuild: true }],
  chart: { title: 'Distance from the normal', x: { label: 'samples', log: true }, y: { label: 'KS distance', log: true } },
  *run(ops, cfg) {
    const pairs = Math.floor(num(cfg, 'n') / 2);
    const z = new Float64Array(2 * pairs);
    const angle: number[] = [];
    let s = 0;
    let s2 = 0;
    let sxy = 0;
    let ks = NaN;
    let k = 0;
    let nextCheck = 50;
    const sorted = new SortedSample();
    for (let f = 1; f <= FRAMES; f++) {
      const end = Math.round((f / FRAMES) * pairs);
      for (; k < end; k++) {
        const u1 = ops.rnd();
        const u2 = ops.rnd();
        const r = Math.sqrt(-2 * Math.log(1 - u1));
        const z1 = r * Math.cos(2 * Math.PI * u2);
        const z2 = r * Math.sin(2 * Math.PI * u2);
        z[2 * k] = z1;
        z[2 * k + 1] = z2;
        angle.push(u2);
        s += z1 + z2;
        s2 += z1 * z1 + z2 * z2;
        sxy += z1 * z2;
        if (k % 4000 === 3999) yield;
      }
      const n = 2 * k;
      sorted.add(z.subarray(sorted.length, n));
      if (n >= nextCheck || f === FRAMES) {
        ks = ksDistance(sorted.values);
        ops.point('KS distance D', n, ks);
        ops.point('5% critical value 1.36/√n', n, 1.36 / Math.sqrt(n));
        nextCheck = Math.ceil(n * 1.25);
      }
      const mean = s / n;
      const v = (s2 - n * mean * mean) / (n - 1);
      const from = Math.max(0, k - 400);
      const pts: [number, number][] = [];
      for (let i = from; i < k; i++) pts.push([z[2 * i], z[2 * i + 1]]);
      ops.frame([
        { kind: 'hist', title: 'Histogram of z and the N(0, 1) density', lo: LO, hi: HI, bins: histogram(z, LO, HI, 48, 0, n), density: DENSITY },
        {
          kind: 'plot', title: 'Latest pairs (z1, z2)', x: [LO, HI], y: [LO, HI],
          dots: [{ pts, tones: angle.slice(from, k), size: 2 }],
          marks: [{ x: 0, tone: -1, dash: true }, { y: 0, tone: -1, dash: true }],
        },
      ], [
        { label: 'Samples', value: fmt(n) },
        { label: 'Mean', value: pm(mean, Math.sqrt(v / n)) },
        { label: 'Variance', value: fmt(v, 4) },
        { label: 'KS distance D', value: `${fmt(ks, 4)} (5% critical ${fmt(1.36 / Math.sqrt(n), 4)})` },
        { label: 'Mean of z1·z2 (0 when uncorrelated)', value: fmt(sxy / k, 4) },
      ]);
      yield;
    }
    const n = 2 * pairs;
    const mean = s / n;
    return { z, mean, variance: (s2 - n * mean * mean) / (n - 1), ks, pairCorrelation: sxy / pairs };
  },
};
