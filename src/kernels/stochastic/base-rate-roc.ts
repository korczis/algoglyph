import { num } from '../../core/plate';
import { fmt, normalCdf, pct, Sampler } from '../../engines/stochastic/sample';
import { detectorSet } from '../../engines/stochastic/scenarios';
import { histogram, type Panel, type StochasticKernel } from '../../engines/stochastic/trace';

export interface Confusion { tp: number; fp: number; tn: number; fn: number }

export function confusion(score: number[], label: number[], t: number): Confusion {
  const c = { tp: 0, fp: 0, tn: 0, fn: 0 };
  score.forEach((s, i) => {
    if (s >= t) { if (label[i]) c.tp++; else c.fp++; } else if (label[i]) c.fn++; else c.tn++;
  });
  return c;
}

/** The empirical ROC curve, every distinct score a threshold, and its area by trapezoids. */
export function roc(score: number[], label: number[]): { pts: [number, number][]; auc: number } {
  const order = score.map((_, i) => i).sort((a, b) => score[b] - score[a]);
  const P = label.reduce((a, b) => a + b, 0);
  const N = label.length - P;
  const pts: [number, number][] = [[0, 0]];
  let tp = 0;
  let fp = 0;
  let auc = 0;
  for (let k = 0; k < order.length;) {
    const s = score[order[k]];
    const fp0 = fp;
    const tp0 = tp;
    while (k < order.length && score[order[k]] === s) {
      if (label[order[k]]) tp++; else fp++;
      k++;
    }
    auc += ((fp - fp0) / N) * ((tp + tp0) / 2 / P);
    pts.push([fp / N, tp / P]);
  }
  return { pts, auc };
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
  run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const n = num(cfg, 'n');
    const dprime = num(cfg, 'dprime');
    const { score, label } = detectorSet(s, n, num(cfg, 'rate'), dprime);
    const P = label.reduce((a, b) => a + b, 0);
    const neg = histogram(score.filter((_, i) => !label[i]), LO, HI, 44);
    const pos = histogram(score.filter((_, i) => label[i]), LO, HI, 44);
    const curve = roc(score, label);
    ops.count(n);
    ops.setSeries('chance', [[0, 0], [1, 1]]);
    const show = (t: number, frames: number, onCurve: boolean) => {
      const c = confusion(score, label, t);
      ops.count(n);
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
          lines: [{ pts: [[0, 0], [1, 1]], tone: -1, dash: true, alpha: 0.5 }, { pts: curve.pts.filter((_, i) => i % Math.max(1, Math.floor(curve.pts.length / 400)) === 0), tone: 0.6, weight: 2 }],
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
    for (let k = 0; k <= SWEEP; k++) show(HI - (k / SWEEP) * (HI - LO), 1, true);
    const t = num(cfg, 'threshold');
    const c = show(t, HOLD, false);
    return { score, label, auc: curve.auc, threshold: t, ...c };
  },
};
