import { num, str } from '../../core/plate';
import { ascending, fmt, pct, Sampler } from '../../engines/stochastic/sample';
import { histogram, type StochasticKernel } from '../../engines/stochastic/trace';
import { COVERAGE, coverageChart, ladder, LEVELS, publishCoverage, repetitionsParam, SHOWN_LEVEL } from './_coverage';

const signal = (x: number) => 1.5 * Math.sin(2 * Math.PI * x) + x;

function noiseSd(x: number, kind: string): number {
  return kind === 'constant' ? 0.4 : 0.1 + 0.6 * x;
}

/** Least-squares polynomial of the given degree, by the normal equations. */
export function polyfit(xs: number[], ys: number[], degree: number): number[] {
  const k = degree + 1;
  const A = Array.from({ length: k }, () => new Array<number>(k + 1).fill(0));
  xs.forEach((x, n) => {
    const pw = Array.from({ length: k }, (_, i) => x ** i);
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) A[i][j] += pw[i] * pw[j];
      A[i][k] += pw[i] * ys[n];
    }
  });
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((row, i) => row[k] / A[i][i]);
}

export const polyval = (c: number[], x: number) => c.reduce((t, ci, i) => t + ci * x ** i, 0);

/** The split-conformal radius: the ceil((n + 1) level)-th smallest calibration residual. */
export function conformalRadius(sortedResiduals: Float64Array, level: number): number {
  const n = sortedResiduals.length;
  const k = Math.ceil((n + 1) * level);
  return k > n ? Infinity : sortedResiduals[k - 1];
}

export interface ConformalResult {
  calibration: number;
  /** Coverage per level, averaged over the repeated experiments. */
  coverage: number[];
  reps: number;
  /** The first experiment's sorted residuals and radius at the shown level. */
  residuals: Float64Array;
  radius: number;
}

const TEST = 200;
const LADDER = 20;

function experiment(s: Sampler, nTrain: number, nCal: number, kind: string, degree: number) {
  const draw = (m: number) => {
    const x = Array.from({ length: m }, () => s.uniform());
    return { x, y: x.map((xi) => signal(xi) + s.normal(0, noiseSd(xi, kind))) };
  };
  const train = draw(nTrain);
  const cal = draw(nCal);
  const test = draw(TEST);
  const c = polyfit(train.x, train.y, degree);
  const residuals = ascending(cal.x.map((x, i) => Math.abs(cal.y[i] - polyval(c, x))));
  return { train, cal, test, c, residuals };
}

// Fit any model on one part of the data; on a second part, never used for fitting, measure
// how far the truth falls from the prediction. With n such residuals, the
// ceil((n + 1)(1 - alpha))-th smallest is a radius that covers a new case with probability at
// least 1 - alpha, whatever the model and the noise, so long as the cases are exchangeable.
export const kernel: StochasticKernel<ConformalResult> = {
  palette: 'phosphor',
  params: [
    {
      kind: 'select', key: 'noise', label: 'Noise', value: 'growing', rebuild: true,
      options: [{ value: 'growing', label: 'Growing with x' }, { value: 'constant', label: 'Constant' }],
    },
    { kind: 'range', key: 'degree', label: 'Model: polynomial degree', min: 1, max: 7, step: 1, value: 3, rebuild: true },
    { kind: 'range', key: 'ncal', label: 'Calibration cases', min: 19, max: 400, step: 1, value: 60, rebuild: true },
    repetitionsParam(),
  ],
  chart: coverageChart,
  labSeries: COVERAGE,
  run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const kind = str(cfg, 'noise');
    const degree = num(cfg, 'degree');
    const nCal = num(cfg, 'ncal');
    const nTrain = 80;
    const reps = num(cfg, 'reps');
    const first = experiment(s, nTrain, nCal, kind, degree);
    ops.count(nTrain + nCal + TEST);
    const q = conformalRadius(first.residuals, SHOWN_LEVEL);
    const curve: [number, number][] = Array.from({ length: 61 }, (_, i) => [i / 60, polyval(first.c, i / 60)]);
    const band: [number, number, number][] = curve.map(([x, y]) => [x, y - q, y + q]);
    const hitsFirst = first.test.x.map((x, i) => Math.abs(first.test.y[i] - polyval(first.c, x)) <= q);
    const ylo = -2.6;
    const yhi = 3.4;
    const rmax = Math.max(q * 1.6, first.residuals[first.residuals.length - 1]);
    const intro = [
      {
        kind: 'plot' as const, title: 'Fit (line), training (faint) and test cases; the band is ± the conformal radius', x: [0, 1] as [number, number], y: [ylo, yhi] as [number, number],
        band: { pts: Number.isFinite(q) ? band : [], tone: 0.55 },
        lines: [{ pts: curve, tone: 0.8, weight: 2 }],
        dots: [
          { pts: first.train.x.map((x, i) => [x, first.train.y[i]] as [number, number]), tone: -1, size: 1.5, alpha: 0.3 },
          { pts: first.test.x.map((x, i) => [x, first.test.y[i]] as [number, number]), tones: hitsFirst.map((h) => (h ? 0.6 : 0.05)), size: 2 },
        ],
      },
      {
        kind: 'hist' as const, title: 'Calibration residuals |y − ŷ| and the 90% radius', lo: 0, hi: rmax, bins: histogram(first.residuals, 0, rmax, 24),
        marks: [{ x: q, label: `radius ${fmt(q, 3)}`, tone: -1 }],
      },
    ];
    const introStats = [
      { label: 'Training / calibration / test cases', value: `${fmt(nTrain)} / ${fmt(nCal)} / ${fmt(TEST)}` },
      { label: '90% radius', value: `${fmt(q, 4)} (residual ${fmt(Math.ceil((nCal + 1) * SHOWN_LEVEL))} of ${fmt(nCal)})` },
      { label: 'Test cases covered', value: pct(hitsFirst.filter(Boolean).length / TEST) },
    ];
    for (let h = 0; h < 60; h++) ops.frame(intro, introStats);
    const hits = new Array<number>(LEVELS.length).fill(0);
    const shown: { label: string; lo: number; hi: number; truth: number }[] = [];
    let width = 0;
    for (let r = 1; r <= reps; r++) {
      const e = r === 1 ? first : experiment(s, nTrain, nCal, kind, degree);
      if (r > 1) ops.count(nTrain + nCal + TEST);
      LEVELS.forEach((l, i) => {
        const rad = conformalRadius(e.residuals, l);
        let k = 0;
        e.test.x.forEach((x, j) => { if (Math.abs(e.test.y[j] - polyval(e.c, x)) <= rad) k++; });
        hits[i] += k / TEST;
      });
      const rad = conformalRadius(e.residuals, SHOWN_LEVEL);
      width += 2 * rad;
      const pred = polyval(e.c, e.test.x[0]);
      shown.push({ label: `run ${r}`, lo: pred - rad, hi: pred + rad, truth: e.test.y[0] });
      if (shown.length > LADDER) shown.shift();
      publishCoverage(ops, hits, r);
      const c = hits[LEVELS.indexOf(SHOWN_LEVEL)] / r;
      ops.frame([intro[0], ladder('One new case per experiment against its 90% interval', shown.slice(), [ylo, yhi])], [
        { label: 'Experiments', value: `${fmt(r)} of ${fmt(reps)}, ${fmt(TEST)} test cases each` },
        { label: '90% intervals covering', value: `${pct(c)} (guarantee: at least 90%)` },
        { label: '50% intervals covering', value: pct(hits[0] / r) },
        { label: 'Mean 90% width', value: fmt(width / r, 4) },
      ]);
    }
    return { calibration: nCal, coverage: hits.map((h) => h / reps), reps, residuals: first.residuals, radius: q };
  },
};
