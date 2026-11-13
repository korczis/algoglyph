import { num, str } from '../../core/plate';
import { fmt, Sampler } from '../../engines/stochastic/sample';
import { OVER_SLOPE, scoredSet } from '../../engines/stochastic/scenarios';
import type { Panel, StochasticKernel } from '../../engines/stochastic/trace';

interface Block { sum: number; w: number; from: number; to: number }

/** Pool adjacent violators: the non-decreasing fit of y (in the given order) with least weighted
 * squared error. Blocks are pooled while a block's mean exceeds its successor's. */
export function pav(y: number[], w: number[] = y.map(() => 1), onMerge?: (blocks: Block[]) => void): number[] {
  const blocks: Block[] = [];
  y.forEach((v, i) => {
    blocks.push({ sum: v * w[i], w: w[i], from: i, to: i });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1];
      const a = blocks[blocks.length - 2];
      if (a.sum / a.w <= b.sum / b.w) break;
      blocks.splice(blocks.length - 2, 2, { sum: a.sum + b.sum, w: a.w + b.w, from: a.from, to: b.to });
      onMerge?.(blocks);
    }
  });
  const out = new Array<number>(y.length);
  for (const b of blocks) for (let i = b.from; i <= b.to; i++) out[i] = b.sum / b.w;
  return out;
}

/** Mean prediction and observed frequency in ten equal-width bins of the prediction. */
function reliability(pred: number[], label: number[]): { pts: [number, number][]; ece: number } {
  const k = 10;
  const sp = new Array<number>(k).fill(0);
  const sy = new Array<number>(k).fill(0);
  const c = new Array<number>(k).fill(0);
  pred.forEach((p, i) => {
    const b = Math.min(k - 1, Math.floor(p * k));
    sp[b] += p; sy[b] += label[i]; c[b]++;
  });
  const pts: [number, number][] = [];
  let ece = 0;
  for (let b = 0; b < k; b++) {
    if (!c[b]) continue;
    pts.push([sp[b] / c[b], sy[b] / c[b]]);
    ece += (c[b] / pred.length) * Math.abs(sp[b] / c[b] - sy[b] / c[b]);
  }
  return { pts, ece };
}

const brier = (pred: number[], label: number[]) => pred.reduce((s, p, i) => s + (p - label[i]) ** 2, 0) / pred.length;

export interface IsotonicResult {
  /** Training scores in ascending order, their labels and the fitted calibration map. */
  score: number[];
  label: number[];
  fitted: number[];
  brierBefore: number;
  brierAfter: number;
  eceBefore: number;
  eceAfter: number;
}

const FRAMES = 140;

// Sort the training cases by score; walking up the scores, each case starts its own block, and
// any block whose observed frequency exceeds the next one's is pooled with it. The blocks'
// frequencies are the calibrated probabilities, a step function of the score; the test half
// of the data, never seen by the fit, measures the result.
export const kernel: StochasticKernel<IsotonicResult> = {
  palette: 'spectral',
  params: [
    {
      kind: 'select', key: 'distortion', label: 'Miscalibration', value: 'over', rebuild: true,
      options: [
        { value: 'over', label: 'Overconfident scores' },
        { value: 'under', label: 'Underconfident scores' },
        { value: 'skewed', label: 'Scores too high' },
      ],
    },
    { kind: 'range', key: 'n', label: 'Training cases', min: 100, max: 5000, step: 100, value: 1200, rebuild: true },
    // the overconfident truth is 0.5 + slope · (x − 0.5). From 0, a truth that ignores the score:
    // below it the truth falls as the score rises and no non-decreasing fit can follow it. To
    // 0.7, not 1, for what the plate shows, not its cost: nearer 1 the scores are so nearly
    // calibrated that the held-out error is mostly the fit's own label noise and calibrating
    // stops lowering it (at 1200 cases it fell in 79 of 80 seeds at 0.7, 69 at 0.8, 22 of 40 at 0.9)
    {
      kind: 'range', key: 'slope', label: 'True-probability slope', min: 0, max: 0.7, step: 0.05,
      value: OVER_SLOPE, rebuild: true, when: { key: 'distortion', values: ['over'] },
      hint: 'How steeply the true probability rises with the score; 1 would be calibrated.',
    },
  ],
  chart: { title: 'Reliability on held-out cases', x: { label: 'predicted probability' }, y: { label: 'observed frequency' } },
  *run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const n = num(cfg, 'n');
    const slope = num(cfg, 'slope');
    const train = yield* scoredSet(s, n, str(cfg, 'distortion'), slope);
    const test = yield* scoredSet(s, n, str(cfg, 'distortion'), slope);
    const order = train.score.map((_, i) => i).sort((a, b) => train.score[a] - train.score[b]);
    const score = order.map((i) => train.score[i]);
    const label = order.map((i) => train.label[i]);
    const truth: [number, number][] = Array.from({ length: 51 }, (_, i) => [i / 50, train.truth(i / 50)]);
    const before = reliability(test.score, test.label);
    const brierBefore = brier(test.score, test.label);
    ops.setSeries('perfect calibration', [[0, 0], [1, 1]]);
    ops.setSeries('before', before.pts);
    let merges = 0;
    const every = Math.max(1, Math.ceil(n / FRAMES));
    yield;
    const labelDots: [number, number][] = score.map((x, i) => [x, label[i] ? 0.98 : 0.02]);
    const frame = (blocks: Block[], upto: number, after: { pts: [number, number][]; ece: number; brier: number } | null, times = 1) => {
      const step: [number, number][] = [];
      for (const b of blocks) {
        const v = b.sum / b.w;
        step.push([score[b.from], v], [score[b.to], v]);
      }
      const panels: Panel[] = [
        {
          kind: 'plot', title: 'Labels (top, bottom), PAV fit so far, true curve dashed', x: [0, 1], y: [0, 1],
          dots: [{ pts: labelDots.slice(0, upto), tones: label.slice(0, upto).map((l) => (l ? 0.85 : 0.15)), size: 1.5, alpha: 0.5 }],
          lines: [{ pts: truth, tone: -1, dash: true, alpha: 0.6 }, { pts: step, tone: 0.75, weight: 2.5 }],
        },
        {
          kind: 'plot', title: 'Reliability diagram (held-out cases)', x: [0, 1], y: [0, 1],
          lines: [
            { pts: [[0, 0], [1, 1]], tone: -1, dash: true, alpha: 0.5 },
            { pts: before.pts, tone: 0.1, weight: 2 },
            ...(after ? [{ pts: after.pts, tone: 0.75, weight: 2.5 }] : []),
          ],
          dots: [{ pts: before.pts, tone: 0.1, size: 3 }, ...(after ? [{ pts: after.pts, tone: 0.75, size: 3 }] : [])],
        },
      ];
      const stats = [
        { label: 'Cases pooled', value: `${fmt(upto)} of ${fmt(n)}` },
        { label: 'Blocks', value: `${fmt(blocks.length)} after ${fmt(merges)} merges` },
        { label: 'Brier score (held out)', value: after ? `${fmt(brierBefore, 4)} → ${fmt(after.brier, 4)}` : fmt(brierBefore, 4) },
        { label: 'Expected calibration error', value: after ? `${fmt(before.ece, 4)} → ${fmt(after.ece, 4)}` : fmt(before.ece, 4) },
      ];
      for (let h = 0; h < times; h++) ops.frame(panels, stats);
    };
    // replay the fit case by case so the frames show it growing
    const blocks: Block[] = [];
    for (let i = 0; i < n; i++) {
      blocks.push({ sum: label[i], w: 1, from: i, to: i });
      ops.count(1);
      while (blocks.length > 1) {
        const b = blocks[blocks.length - 1];
        const a = blocks[blocks.length - 2];
        ops.count(1);
        if (a.sum / a.w <= b.sum / b.w) break;
        blocks.splice(blocks.length - 2, 2, { sum: a.sum + b.sum, w: a.w + b.w, from: a.from, to: b.to });
        merges++;
      }
      if ((i + 1) % every === 0 && i + 1 < n) {
        frame(blocks, i + 1, null);
        yield;
      }
    }
    yield;
    const fitted = pav(label);
    const calibrate = (x: number) => {
      let lo = 0;
      let hi = n - 1;
      if (x <= score[0]) return fitted[0];
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (score[mid] <= x) lo = mid; else hi = mid - 1;
      }
      return fitted[lo];
    };
    const pred = test.score.map(calibrate);
    const after = { ...reliability(pred, test.label), brier: brier(pred, test.label) };
    ops.setSeries('after', after.pts);
    frame(blocks, n, after, 40);
    return { score, label, fitted, brierBefore, brierAfter: after.brier, eceBefore: before.ece, eceAfter: after.ece };
  },
};
