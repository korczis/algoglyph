// U-stochastic: base-rate-roc runs exactly as before on its seeded binormal scores
// (test/u-stochastic/same-runs.ts), and on a reader's scores and labels it sweeps those. Checked
// against references that share no code with the kernel: the AUC as the share of
// (positive, negative) pairs the positive wins, ties counting a half (Mann–Whitney), and the
// confusion counts at the threshold k standard deviations above the negatives' mean, counted here.
import { describe, expect, it } from 'vitest';
import { optionValue, type DataTable } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Runner, type Frame, type StochasticKernel } from '../../src/engines/stochastic/trace';
import { kernel as now, type RocResult } from '../../src/kernels/stochastic/base-rate-roc';
import { kernel as before } from '../fixtures/u-stochastic-before/src/kernels/stochastic/base-rate-roc';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('base-rate-roc', now, before);

// same-runs.ts records the first 30 drawn frames; the held threshold comes after the sweep, so the
// whole seeded run, every recorded frame and the result, is compared too, at each range's ends
const whole = (k: StochasticKernel, p: Params) => {
  const r = new Runner(k, p, 11);
  // one piece per step, so where the run yields (the draws made by each) is compared as well as what it records
  const pieces: number[] = [];
  while (!r.done) { r.step(Infinity, 1); pieces.push(r.counts.draws); }
  return JSON.stringify({ frames: r.frames, result: r.result, counts: r.counts, pieces });
};
describe('U-stochastic: base-rate-roc\'s whole seeded run is the run it was', () => {
  it('every frame to the end, at the defaults and at both ends of every range', () => {
    const corners: Params[] = [{}];
    for (const d of before.params ?? []) if (d.kind === 'range') corners.push({ [d.key]: d.min }, { [d.key]: d.max });
    for (const c of corners) expect(whole(now, c) === whole(before, c), JSON.stringify(c)).toBe(true);
  }, 120_000);
});

const cases = (score: number[], label: number[]) => (id: string): DataTable | null => (id === 'cases'
  ? {
    id, columns: [{ key: 'score', unit: '1' }, { key: 'label', unit: '1' }],
    values: [Float64Array.from(score), Float64Array.from(label)], rows: score.length, canonical: '', digest: '',
  }
  : null);

function run(score: number[], label: number[], threshold = 2): { last: Frame; result: RocResult } {
  const r = new Runner(now, { scores: optionValue('cases'), threshold }, 7, cases(score, label));
  while (!r.done) r.step(1000);
  return { last: r.frames[r.frames.length - 1], result: r.result! };
}
const value = (f: Frame, label: string) => f.stats.find((s) => s.label === label)?.value ?? '';

describe('base-rate-roc on your scores and labels', () => {
  // 60 cases with ties and labels given as probabilities: 0.5 and above is positive
  const score = Array.from({ length: 60 }, (_, i) => Math.round(10 * Math.sin(i * 2.3) + i / 6) / 2);
  const label = score.map((_, i) => [0, 0.2, 1, 0.7, 0, 0.49][i % 6] * (i % 7 === 0 ? 0 : 1));
  const pos = label.map((l) => l >= 0.5);

  it('measures the AUC of your cases: the share of positive-negative pairs the positive wins', () => {
    let wins = 0; let pairs = 0;
    for (let i = 0; i < score.length; i++) for (let j = 0; j < score.length; j++) {
      if (!pos[i] || pos[j]) continue;
      pairs++;
      wins += score[i] > score[j] ? 1 : score[i] === score[j] ? 0.5 : 0;
    }
    const { last, result } = run(score, label);
    const P = pos.filter(Boolean).length;
    expect(value(last, 'Input')).toBe(`your data, 60 scores, ${P} labelled positive`);
    expect(result.auc).toBeCloseTo(wins / pairs, 12);
    expect(value(last, 'AUC')).toBe((wins / pairs).toFixed(4));
    expect(value(last, 'Base rate (measured)')).toBe(`${(100 * P / 60).toFixed(2)}% of 60`);
  });

  it('holds the threshold k standard deviations above the negatives\' mean, and counts the alarms there', () => {
    const negs = score.filter((_, i) => !pos[i]);
    const m = negs.reduce((a, v) => a + v, 0) / negs.length;
    const sd = Math.sqrt(negs.reduce((a, v) => a + (v - m) ** 2, 0) / (negs.length - 1));
    for (const k of [-1, 0.5, 1.5]) {
      const t = m + k * sd;
      const tp = score.filter((s, i) => s >= t && pos[i]).length;
      const fp = score.filter((s, i) => s >= t && !pos[i]).length;
      const { result } = run(score, label, k);
      expect(result.threshold).toBeCloseTo(t, 12);
      expect([result.tp, result.fp]).toEqual([tp, fp]);
    }
  });

  it('has no AUC to measure when every label is one class', () => {
    const { last } = run(score, score.map(() => 1));
    expect(value(last, 'AUC')).toMatch(/^none: /);
  });
});
