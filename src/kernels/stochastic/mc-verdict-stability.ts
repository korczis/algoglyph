import { num } from '../../core/plate';
import { fmt, pct, Sampler } from '../../engines/stochastic/sample';
import { evidenceSet, type EvidenceItem } from '../../engines/stochastic/scenarios';
import { histogram, type StochasticKernel } from '../../engines/stochastic/trace';

export interface VerdictResult {
  items: EvidenceItem[];
  /** Prior log-odds of the hypothesis; the verdict is "supported" when the posterior log-odds
   * are positive. */
  prior: number;
  baseline: boolean;
  /** Share of perturbed runs whose verdict equals the baseline's. */
  stability: number;
  runs: number;
  noise: number;
}

const FRAMES = 140;
const LO = -8;
const HI = 8;

// The verdict is what the evidence says as given: the prior log-odds plus every item's
// log-likelihood ratio, compared with zero. Each run perturbs it the way it could be wrong:
// every item holds up only with its reliability, and its strength wobbles by its standard
// deviation. The share of runs that reach the same verdict is its stability.
export const kernel: StochasticKernel<VerdictResult> = {
  palette: 'spectral',
  params: [
    { kind: 'range', key: 'k', label: 'Evidence items', min: 2, max: 12, step: 1, value: 7, rebuild: true },
    { kind: 'range', key: 'prior', label: 'Prior log-odds', min: -4, max: 4, step: 0.1, value: -1, rebuild: true },
    { kind: 'range', key: 'noise', label: 'Strength noise (× each item’s sd)', min: 0, max: 3, step: 0.1, value: 1, rebuild: true },
    { kind: 'range', key: 'n', label: 'Perturbed runs', min: 200, max: 40000, step: 200, value: 5000, rebuild: true },
  ],
  chart: { title: 'Verdict stability as runs accumulate', x: { label: 'runs', log: true }, y: { label: 'share of runs agreeing' } },
  run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const k = num(cfg, 'k');
    const prior = num(cfg, 'prior');
    const noise = num(cfg, 'noise');
    const n = num(cfg, 'n');
    const items = evidenceSet(s, k);
    const total = prior + items.reduce((t, e) => t + e.llr, 0);
    const baseline = total > 0;
    const scores: number[] = [];
    let agree = 0;
    // flips counted with each item dropped and with it kept, to measure its influence
    const flipDropped = new Array<number>(k).fill(0);
    const dropped = new Array<number>(k).fill(0);
    const flipKept = new Array<number>(k).fill(0);
    let done = 0;
    for (let fr = 1; fr <= FRAMES; fr++) {
      const end = Math.max(1, Math.round(n * (fr / FRAMES) ** 2));
      for (; done < end; done++) {
        let lo = prior;
        const kept: boolean[] = [];
        for (const e of items) {
          const holds = s.bernoulli(e.reliability);
          kept.push(holds);
          if (holds) lo += e.llr + (noise ? s.normal(0, e.sd * noise) : 0);
        }
        ops.count(1);
        scores.push(lo);
        const same = lo > 0 === baseline;
        if (same) agree++;
        kept.forEach((h, i) => {
          if (!h) { dropped[i]++; if (!same) flipDropped[i]++; } else if (!same) flipKept[i]++;
        });
      }
      const st = agree / done;
      const se = Math.sqrt(Math.max(st * (1 - st), 1e-9) / done);
      ops.point('stability', done, st);
      ops.point('lower 2 SE', done, Math.max(0, st - 2 * se));
      ops.point('upper 2 SE', done, Math.min(1, st + 2 * se));
      const influence = items.map((_, i) => flipDropped[i] / Math.max(1, dropped[i]) - flipKept[i] / Math.max(1, done - dropped[i]));
      const top = influence.reduce((b, v, i) => (v > influence[b] ? i : b), 0);
      ops.frame([
        {
          kind: 'hist', title: 'Posterior log-odds over perturbed runs; verdict flips left of 0', lo: LO, hi: HI,
          bins: histogram(scores, LO, HI, 48), shade: baseline ? [LO, 0] : [0, HI],
          marks: [{ x: 0, label: 'threshold', tone: -1 }, { x: total, label: 'as given', tone: 0.9, dash: true }],
        },
        {
          kind: 'bars', title: 'Items: log-likelihood ratio ± 2 sd × noise; label shows reliability', x: [-2.5, 2.5],
          rows: items.map((e) => ({
            label: `${e.label} r=${fmt(e.reliability, 2)}`, lo: 0, hi: e.llr, tone: e.llr > 0 ? 0.85 : 0.1,
            ...(noise ? { err: [e.llr - 2 * e.sd * noise, e.llr + 2 * e.sd * noise] as [number, number] } : {}),
          })),
        },
      ], [
        { label: 'Verdict as given', value: `${baseline ? 'supported' : 'not supported'} (log-odds ${fmt(total, 2)})` },
        { label: 'Stability', value: `${pct(st)} ± ${pct(se)}` },
        { label: 'Runs', value: `${fmt(done)}; ${fmt(done - agree)} flipped` },
        { label: `Most influential: ${items[top].label}`, value: `flips ${pct(influence[top])} more often when it fails` },
      ]);
    }
    return { items, prior, baseline, stability: agree / n, runs: n, noise };
  },
};
