// Least squares: fit polynomials of rising degree to noisy samples by Householder QR, and watch
// the training residual fall while the error on held-out samples turns back up.
import { gaussian, mulberry32 } from '../../core/random';
import { fmt, int, sample, span, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';
import { target, targetParam } from './_functions';
import { lstsq, matvec, polyval, transpose, vandermonde } from './_linalg';

const DEGREES = Array.from({ length: 16 }, (_, d) => d);

export const kernel: NumericKernel = {
  params: [
    targetParam(),
    { kind: 'range', key: 'samples', label: 'Training samples', min: 12, max: 80, step: 1, value: 24, rebuild: true },
    { kind: 'range', key: 'noise', label: 'Noise σ', min: 0, max: 0.3, step: 0.01, value: 0.08, rebuild: true },
  ],
  thumb: 0.3,
  run({ seed, params }) {
    const t = target(params.target);
    const rnd = mulberry32(seed);
    const m = Number(params.samples ?? 24);
    const sigma = Number(params.noise ?? 0.08);
    const draw = (k: number) => Array.from({ length: k }, () => 2 * rnd() - 1).sort((a, b) => a - b);
    const xs = draw(m);
    const ys = xs.map((x) => t.f(x) + sigma * gaussian(rnd));
    const hx = draw(m);
    const hy = hx.map((x) => t.f(x) + sigma * gaussian(rnd));
    const train: XY[] = []; const held: XY[] = [];
    const fits = DEGREES.filter((d) => d < m).map((d) => {
      const X = vandermonde(xs, d);
      const { beta, residual } = lstsq(X, ys);
      const rss = residual.reduce((s, r) => s + r * r, 0);
      const ortho = Math.max(...matvec(transpose(X), residual).map(Math.abs));
      const rms = Math.sqrt(hx.reduce((s, x, i) => s + (hy[i] - polyval(beta, x)) ** 2, 0) / hx.length);
      train.push([d, Math.sqrt(rss / m)]);
      held.push([d, rms]);
      return { d, beta, residual, rss, ortho, rms };
    });
    const yr = span([...ys, ...hy], 0.15);
    const best = held.reduce((b, q) => (q[1] < b[1] ? q : b), held[0]);
    const steps = fits.map((fit, k) => {
      const curve = sample((x) => polyval(fit.beta, x), -1, 1, 400);
      const layers: Layer[] = [
        { kind: 'curve', pts: sample(t.f, -1, 1, 300), alpha: 0.3, weight: 3 },
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
        ],
      };
    });
    const rr = span(fits.flatMap((f) => f.residual), 0.1);
    return {
      panels: [
        { title: `${t.label}: training (filled) and held-out samples`, x: [-1, 1], y: yr, axes: true, weight: 1.5 },
        { title: 'Residuals', x: [-1, 1], y: [Math.min(rr[0], -rr[1]), Math.max(rr[1], -rr[0])], axes: true },
      ],
      steps,
    };
  },
};
