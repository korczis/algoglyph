// TOPSIS: normalise each criterion by its Euclidean norm, weight it, find the ideal and the
// anti-ideal option, and rank every option by its relative closeness D− / (D+ + D−). The
// sensitivity chart repeats the whole computation as the chosen criterion's weight moves.
import { mulberry32 } from '../../core/random';
import { fmt, type Layer, type NumericKernel, type XY } from '../../engines/numeric/trace';
import type { Mat } from './_linalg';

export interface Topsis { normal: Mat; weighted: Mat; ideal: number[]; anti: number[]; dPlus: number[]; dMinus: number[]; closeness: number[] }

/** `benefit[j]` true when more is better on criterion j. */
export function topsis(X: Mat, weights: number[], benefit: boolean[]): Topsis {
  const k = weights.length;
  const norms = Array.from({ length: k }, (_, j) => Math.sqrt(X.reduce((s, r) => s + r[j] * r[j], 0)) || 1);
  const normal = X.map((r) => r.map((v, j) => v / norms[j]));
  const weighted = normal.map((r) => r.map((v, j) => v * weights[j]));
  const col = (j: number) => weighted.map((r) => r[j]);
  const ideal = Array.from({ length: k }, (_, j) => (benefit[j] ? Math.max(...col(j)) : Math.min(...col(j))));
  const anti = Array.from({ length: k }, (_, j) => (benefit[j] ? Math.min(...col(j)) : Math.max(...col(j))));
  const dist = (r: number[], p: number[]) => Math.sqrt(r.reduce((s, v, j) => s + (v - p[j]) ** 2, 0));
  const dPlus = weighted.map((r) => dist(r, ideal));
  const dMinus = weighted.map((r) => dist(r, anti));
  const closeness = dPlus.map((d, i) => (d + dMinus[i] ? dMinus[i] / (d + dMinus[i]) : 0));
  return { normal, weighted, ideal, anti, dPlus, dMinus, closeness };
}

export const CRITERIA = ['Quality', 'Coverage', 'Cost', 'Risk'];
export const BENEFIT = [true, true, false, false];
const NAMES = 'ABCDEFGHIJKLMNOP';

/** Weight w1 on criterion `swept` (the first by default), (1 - w1) / 3 on each of the others. */
export function weightsFor(w1: number, swept = 0): number[] {
  const rest = (1 - w1) / 3;
  return CRITERIA.map((_, j) => (j === swept ? w1 : rest));
}

export const kernel: NumericKernel = {
  params: [
    { kind: 'range', key: 'options', label: 'Options', min: 4, max: 12, step: 1, value: 7, rebuild: true },
    { kind: 'select', key: 'swept', label: 'Criterion to weigh', value: 'quality', rebuild: true,
      options: CRITERIA.map((c) => ({ value: c.toLowerCase(), label: c })) },
    { kind: 'range', key: 'w1', label: 'Weight of the chosen criterion', min: 0.05, max: 0.85, step: 0.05, value: 0.4, rebuild: true },
  ],
  aspect: 16 / 9,
  run({ seed, params }) {
    const rnd = mulberry32(seed);
    const n = Number(params.options ?? 7);
    const w1 = Number(params.w1 ?? 0.4);
    const chosen = Math.max(0, CRITERIA.findIndex((c) => c.toLowerCase() === String(params.swept ?? 'quality')));
    const name = CRITERIA[chosen];
    const X: Mat = Array.from({ length: n }, () => [1 + 9 * rnd(), 1 + 9 * rnd(), 10 + 90 * rnd(), 1 + 4 * rnd()]);
    const w = weightsFor(w1, chosen);
    const t = topsis(X, w, BENEFIT);
    const order = t.closeness.map((_, i) => i).sort((a, b) => t.closeness[b] - t.closeness[a]);
    const sens = Array.from({ length: n }, (_, i) => ({
      name: `Option ${NAMES[i]}`,
      points: Array.from({ length: 19 }, (_, s) => { const v = 0.05 + 0.05 * s; return [v, topsis(X, weightsFor(v, chosen), BENEFIT).closeness[i]] as XY; }),
    }));
    const chart = { title: `Closeness as the weight of ${name} moves`, x: { label: `weight of ${name}` }, y: { label: 'closeness to the ideal' }, series: sens };
    const colNorm = (M: Mat) => {
      const lo = Array.from({ length: 4 }, (_, j) => Math.min(...M.map((r) => r[j])));
      const hi = Array.from({ length: 4 }, (_, j) => Math.max(...M.map((r) => r[j])));
      return M.flatMap((r) => r.map((v, j) => (hi[j] > lo[j] ? (v - lo[j]) / (hi[j] - lo[j]) : 0.5)));
    };
    const dmax = Math.max(...t.dPlus, ...t.dMinus) * 1.1;
    const stages: { title: string; M: Mat; note: string }[] = [
      { title: 'Raw scores', M: X, note: 'raw scores, each column shaded on its own range' },
      { title: 'Divided by each column’s norm', M: t.normal, note: 'each column divided by its Euclidean norm' },
      { title: 'Weighted', M: t.weighted, note: `weights ${w.map((v) => fmt(v, 3)).join(', ')}` },
      { title: 'Ideal and anti-ideal', M: [...t.weighted, t.ideal, t.anti], note: 'last two rows: ideal (best per column), anti-ideal (worst)' },
      { title: 'Distances to both', M: [...t.weighted, t.ideal, t.anti], note: 'D+ to the ideal, D− to the anti-ideal' },
      { title: 'Ranked by closeness', M: order.map((i) => t.weighted[i]), note: 'rows reordered best first' },
    ];
    const steps = stages.map((s, k) => {
      const rows = s.M.length;
      const layers: Layer[] = [{ kind: 'grid', rows, cols: 4, values: colNorm(s.M), lo: 0, hi: 1, box: [0, 0, 4, rows] }];
      const labels = k === 5 ? order : Array.from({ length: rows }, (_, i) => i);
      labels.forEach((i, r) => layers.push({ kind: 'text', x: -0.1, y: rows - r - 0.5, align: 'right', text: i < n ? NAMES[i] : r === n ? 'ideal' : 'anti' }));
      CRITERIA.forEach((c, j) => layers.push({ kind: 'text', x: j + 0.5, y: rows + 0.4, align: 'center', text: `${c}${BENEFIT[j] ? ' ↑' : ' ↓'}` }));
      if (k >= 4) {
        layers.push({ kind: 'segments', panel: 1, segs: [0.25, 0.5, 0.75].map((c): [number, number, number, number] => [0, 0, dmax, (dmax * c) / (1 - c)]), alpha: 0.25 });
        layers.push({ kind: 'points', panel: 1, pts: t.dPlus.map((d, i) => [d, t.dMinus[i]] as XY), tones: t.closeness, size: 10 });
        t.dPlus.forEach((d, i) => layers.push({ kind: 'text', panel: 1, x: d + dmax * 0.02, y: t.dMinus[i], text: NAMES[i] }));
      }
      return {
        layers,
        stats: [
          { label: 'Stage', value: `${k + 1}: ${s.note}` },
          { label: 'Ranking', value: k === 5 ? order.map((i) => `${NAMES[i]} ${fmt(t.closeness[i], 3)}`).join(' > ') : 'after the distances' },
          { label: 'Best', value: k >= 4 ? `Option ${NAMES[order[0]]}: D+ ${fmt(t.dPlus[order[0]], 3)}, D− ${fmt(t.dMinus[order[0]], 3)}` : 'pending' },
          { label: 'Weights', value: w.map((v, j) => `${CRITERIA[j]} ${fmt(v, 3)}`).join(', ') },
        ],
      };
    });
    return {
      panels: [
        { title: stages[0].title, x: [-1.4, 4.1], y: [0, n + 3], weight: 1.1 },
        { title: 'D+ against D− (lines: closeness ¼, ½, ¾)', x: [0, dmax], y: [0, dmax], equal: true },
      ],
      steps,
      chart,
    };
  },
};
