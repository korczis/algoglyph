// Least squares: fit polynomials of rising degree to noisy samples by Householder QR, and watch
// the training residual fall while the error on held-out samples turns back up. A reader's own
// points (ADR 0010) replace the function: x is mapped onto [−1, 1], and a seeded half of the
// points trains while the other half is held out.
import { optionId, type DataTable } from '../../core/data';
import { gaussian, mulberry32 } from '../../core/random';
import { fmt, int, sample, span, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';
import { target, targetParam } from './_functions';
import { lstsq, matvec, polyval, transpose, vandermonde } from './_linalg';

const DEGREES = Array.from({ length: 16 }, (_, d) => d);

/** Training and held-out samples on [−1, 1], with what the panel and the readouts say about them. */
interface Samples {
  xs: number[]; ys: number[]; hx: number[]; hy: number[];
  /** The curve the samples come from, when it is known (never for a reader's data). */
  truth: ((x: number) => number) | null;
  title: string;
  /** Distinct training abscissae: a polynomial of degree d needs d + 1 of them. */
  distinct: number;
  input: { label: string; value: string }[];
}

/** A reader's points: x mapped linearly onto [−1, 1], a seeded half held out. */
export function fromTable(t: DataTable, seed: number): Samples {
  const x = t.values[0]; const y = t.values[1];
  let lo = Infinity; let hi = -Infinity;
  for (const v of x) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const scale = hi > lo ? 2 / (hi - lo) : 0;
  const order = Array.from({ length: t.rows }, (_, i) => i);
  const rnd = mulberry32(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const cut = Math.ceil(t.rows / 2);
  const pick = (idx: number[]) => idx.map((i) => [scale ? (x[i] - lo) * scale - 1 : 0, y[i]] as XY).sort((a, b) => a[0] - b[0]);
  const train = pick(order.slice(0, cut));
  const held = pick(order.slice(cut));
  const [ux, uy] = t.columns.map((c) => c.unit);
  return {
    xs: train.map((p) => p[0]), ys: train.map((p) => p[1]), hx: held.map((p) => p[0]), hy: held.map((p) => p[1]),
    truth: null,
    title: `Your points (${t.rows}): x in ${ux} mapped onto [−1, 1], y in ${uy}`,
    distinct: new Set(train.map((p) => p[0])).size,
    input: [
      { label: 'Input', value: `your data, ${int(t.rows)} rows: ${int(cut)} train, ${int(t.rows - cut)} held out` },
      { label: 'x mapped onto [−1, 1] from', value: `[${fmt(lo)}, ${fmt(hi)}] ${ux}` },
    ],
  };
}

function seeded(seed: number, params: Record<string, unknown>): Samples {
  const t = target(params.target);
  const rnd = mulberry32(seed);
  const m = Number(params.samples ?? 24);
  const sigma = Number(params.noise ?? 0.08);
  const draw = (k: number) => Array.from({ length: k }, () => 2 * rnd() - 1).sort((a, b) => a - b);
  const xs = draw(m);
  const ys = xs.map((x) => t.f(x) + sigma * gaussian(rnd));
  const hx = draw(m);
  const hy = hx.map((x) => t.f(x) + sigma * gaussian(rnd));
  return { xs, ys, hx, hy, truth: t.f, title: `${t.label}: training (filled) and held-out samples`, distinct: m, input: [] };
}

export const kernel: NumericKernel = {
  params: [
    targetParam(),
    { kind: 'range', key: 'samples', label: 'Training samples', min: 12, max: 80, step: 1, value: 24, rebuild: true },
    { kind: 'range', key: 'noise', label: 'Noise σ', min: 0, max: 0.3, step: 0.01, value: 0.08, rebuild: true },
  ],
  thumb: 0.3,
  run({ seed, params, data }) {
    const id = optionId(params.target);
    const table = id ? data?.(id) ?? null : null;
    const { xs, ys, hx, hy, truth, title, distinct, input } = table ? fromTable(table, seed) : seeded(seed, params);
    const m = xs.length;
    const train: XY[] = []; const held: XY[] = [];
    const fits = DEGREES.filter((d) => d < m && d < distinct).map((d) => {
      const X = vandermonde(xs, d);
      const { beta, residual } = lstsq(X, ys);
      const rss = residual.reduce((s, r) => s + r * r, 0);
      const ortho = Math.max(...matvec(transpose(X), residual).map(Math.abs));
      const rms = hx.length ? Math.sqrt(hx.reduce((s, x, i) => s + (hy[i] - polyval(beta, x)) ** 2, 0) / hx.length) : NaN;
      train.push([d, Math.sqrt(rss / m)]);
      held.push([d, rms]);
      return { d, beta, residual, rss, ortho, rms };
    });
    const yr = span([...ys, ...hy], 0.15);
    const best = held.reduce((b, q) => (q[1] < b[1] ? q : b), held[0]);
    const steps = fits.map((fit, k) => {
      const curve = sample((x) => polyval(fit.beta, x), -1, 1, 400);
      const layers: Layer[] = [
        ...(truth ? [{ kind: 'curve', pts: sample(truth, -1, 1, 300), alpha: 0.3, weight: 3 } as Layer] : []),
        { kind: 'segments', segs: xs.map((x, i) => [x, ys[i], x, ys[i] - fit.residual[i]] as [number, number, number, number]), tone: 0.85, alpha: 0.8 },
        { kind: 'points', pts: hx.map((x, i) => [x, hy[i]] as XY), size: 4, alpha: 0.35 },
        { kind: 'points', pts: xs.map((x, i) => [x, ys[i]] as XY), size: 5, tone: 0.85 },
        { kind: 'curve', pts: curve, tone: 0.1, weight: 2.5 },
        { kind: 'rects', panel: 1, rects: xs.map((x, i) => [x - 0.012, 0, 0.024, fit.residual[i], fit.residual[i] > 0 ? 0.8 : 0.15] as [number, number, number, number, number]) },
      ];
      return {
        layers,
        chart: {
          title: 'RMS error against degree',
          x: { label: 'degree' }, y: { label: 'RMS error', log: true },
          series: [{ name: 'Training', points: train.slice(0, k + 1) }, { name: 'Held out', points: held.slice(0, k + 1) }],
        },
        stats: [
          { label: 'Degree', value: int(fit.d) },
          { label: 'Residual sum of squares', value: fmt(fit.rss) },
          { label: 'RMS on held-out samples', value: fmt(fit.rms) },
          { label: 'max |Xᵀr| (normal equations)', value: fmt(fit.ortho) },
          { label: 'Best held-out degree', value: `${best[0]} (RMS ${fmt(best[1])})` },
          ...input,
        ],
      };
    });
    const rr = span(fits.flatMap((f) => f.residual), 0.1);
    return {
      panels: [
        { title, x: [-1, 1], y: yr, axes: true, weight: 1.5 },
        { title: 'Residuals', x: [-1, 1], y: [Math.min(rr[0], -rr[1]), Math.max(rr[1], -rr[0])], axes: true },
      ],
      steps,
    };
  },
};
