import { num } from '../../core/plate';
import { fmt, normalCdf, pct, Sampler, sortDescending } from '../../engines/stochastic/sample';
import { histogram, type Panel, type StochasticKernel } from '../../engines/stochastic/trace';

export interface Confusion { tp: number; fp: number; tn: number; fn: number }

/** Scores in descending order with the running count of positives, so the confusion counts at
 * any threshold are read off by one binary search instead of a pass over the population. */
export class Ranked {
  constructor(readonly desc: Float64Array, readonly positivesAbove: Int32Array) {}
  get n(): number { return this.desc.length; }
  get positives(): number { return this.positivesAbove[this.n]; }
  /** How many scores are at least t. */
  above(t: number): number {
    let lo = 0;
    let hi = this.n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.desc[mid] >= t) lo = mid + 1; else hi = mid;
    }
    return lo;
  }
  confusion(t: number): Confusion {
    const k = this.above(t);
    const tp = this.positivesAbove[k];
    const P = this.positives;
    return { tp, fp: k - tp, fn: P - tp, tn: this.n - P - (k - tp) };
  }
}

export interface RocResult extends Confusion {
  score: number[];
  label: number[];
  auc: number;
  threshold: number;
}

const SWEEP = 120;
const HOLD = 60;
const LO = -4;
const HI = 7;

// Negatives score N(0, 1), positives N(d', 1), and positives are rare. Lowering the threshold
// walks the ROC curve up from (0, 0): more positives caught, more negatives alarmed. The share
// of alarms that are real (the precision) depends on the base rate as much as on the detector.
export const kernel: StochasticKernel<RocResult> = {
  palette: 'abyss',
  params: [
    { kind: 'range', key: 'rate', label: 'Base rate of positives', min: 0.001, max: 0.5, step: 0.001, value: 0.01, rebuild: true },
    { kind: 'range', key: 'dprime', label: "Separation d'", min: 0.5, max: 4, step: 0.1, value: 2, rebuild: true },
    { kind: 'range', key: 'threshold', label: 'Alarm threshold', min: -2, max: 5, step: 0.05, value: 2, rebuild: true },
    { kind: 'range', key: 'n', label: 'Population', min: 2000, max: 100000, step: 1000, value: 20000, rebuild: true },
  ],
  chart: { title: 'ROC curve', x: { label: 'false positive rate' }, y: { label: 'true positive rate' } },
  *run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const n = num(cfg, 'n');
    const dprime = num(cfg, 'dprime');
    const rate = num(cfg, 'rate');
    const score: number[] = [];
    const label: number[] = [];
    const neg = new Array<number>(44).fill(0);
    const pos = new Array<number>(44).fill(0);
    for (let i = 0; i < n; i++) {
      const isPos = s.bernoulli(rate);
      label.push(isPos ? 1 : 0);
      score.push(s.normal(isPos ? dprime : 0, 1));
      histogram(score, LO, HI, 44, i, i + 1, isPos ? pos : neg);
      if (i % 5000 === 4999) yield;
    }
    const order = yield* sortDescending(score);
    const desc = new Float64Array(n);
    const above = new Int32Array(n + 1);
    for (let k = 0; k < n; k++) {
      desc[k] = score[order[k]];
      above[k + 1] = above[k] + label[order[k]];
    }
    const ranked = new Ranked(desc, above);
    const P = ranked.positives;
    const N = n - P;
    // the empirical ROC, every distinct score a threshold, and its area by trapezoids
    const pts: [number, number][] = [[0, 0]];
    let auc = 0;
    for (let k = 0; k < n;) {
      const k0 = k;
      while (k < n && desc[k] === desc[k0]) k++;
      const tp0 = above[k0];
      const tp = above[k];
      auc += ((k - tp - (k0 - tp0)) / Math.max(1, N)) * ((tp + tp0) / 2 / Math.max(1, P));
      pts.push([(k - tp) / Math.max(1, N), tp / Math.max(1, P)]);
      if (k % 10000 < k - k0) yield;
    }
    const curve = { pts: pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 400)) === 0 || i === pts.length - 1), auc };
    ops.count(n);
    yield;
    ops.setSeries('chance', [[0, 0], [1, 1]]);
    const show = (t: number, frames: number, onCurve: boolean) => {
      const c = ranked.confusion(t);
      ops.count(1);
      const tpr = c.tp / Math.max(1, c.tp + c.fn);
      const fpr = c.fp / Math.max(1, c.fp + c.tn);
      const ppv = c.tp / Math.max(1, c.tp + c.fp);
      if (onCurve) ops.point('ROC', fpr, tpr);
      else ops.setSeries('operating point', [[fpr, tpr]]);
      const panels = [
        {
          kind: 'hist', title: 'Scores within each class: negatives (bars), positives (outline)', lo: LO, hi: HI,
          bins: neg, tone: 0.3, overlay: { bins: pos, tone: 0.85 }, normalise: true, shade: [t, HI],
          marks: [{ x: t, label: 'threshold', tone: -1 }],
        },
        {
          kind: 'plot', title: 'ROC: the swept threshold', x: [0, 1], y: [0, 1],
          lines: [{ pts: [[0, 0], [1, 1]], tone: -1, dash: true, alpha: 0.5 }, { pts: curve.pts, tone: 0.6, weight: 2 }],
          dots: [{ pts: [[fpr, tpr]], tone: 0.95, size: 5 }],
        },
        {
          kind: 'bars', title: 'What the alarms are', x: [0, 1],
          rows: [
            { label: 'alarms that are real', lo: 0, hi: ppv, tone: 0.85 },
            { label: 'alarms that are false', lo: 0, hi: 1 - ppv, tone: 0.3 },
            { label: 'positives caught', lo: 0, hi: tpr, tone: 0.65 },
            { label: 'negatives alarmed', lo: 0, hi: fpr, tone: 0.15 },
          ],
        },
      ] as Panel[];
      const stats = [
        { label: 'Base rate (measured)', value: `${pct(P / n, 2)} of ${fmt(n)}` },
        { label: 'Threshold', value: fmt(t, 2) },
        { label: 'True / false positive rate', value: `${pct(tpr)} / ${pct(fpr, 2)}` },
        { label: 'Precision (alarms that are real)', value: `${pct(ppv)}: ${fmt(c.tp)} real, ${fmt(c.fp)} false` },
        { label: 'AUC', value: `${fmt(curve.auc, 4)} (binormal Φ(d'/√2) = ${fmt(normalCdf(dprime / Math.SQRT2), 4)})` },
      ];
      for (let h = 0; h < frames; h++) ops.frame(panels, stats);
      return c;
    };
    for (let k = 0; k <= SWEEP; k++) {
      show(HI - (k / SWEEP) * (HI - LO), 1, true);
      yield;
    }
    const t = num(cfg, 'threshold');
    const c = show(t, HOLD, false);
    return { score, label, auc: curve.auc, threshold: t, ...c };
  },
};
