import type { DataTable } from '../../core/data';
import { num, type Stat } from '../../core/plate';
import { readerInput, readerTable } from '../../engines/stochastic/reader';
import { fmt, pct, Sampler } from '../../engines/stochastic/sample';
import {
  evidenceSet, MIN_RELIABILITY, type EvidenceItem,
} from '../../engines/stochastic/scenarios';
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
/** The readout of the enumerated stability, shown only with no strength noise. */
const EXACT = 'Exact stability (no strength noise)';

/** The share of runs that keep the verdict when strengths do not wobble: the sum, over every
 * subset of items that hold up, of its chance, where the subset's verdict is the baseline's. */
function exactStability(items: EvidenceItem[], prior: number, baseline: boolean): number {
  let out = 0;
  for (let set = 0; set < 1 << items.length; set++) {
    let p = 1;
    let lo = prior;
    items.forEach((e, i) => {
      if (set & (1 << i)) { p *= e.reliability; lo += e.llr; } else p *= 1 - e.reliability;
    });
    if (lo > 0 === baseline) out += p;
  }
  return out;
}
const LO = -8;
const HI = 8;

/** A reader's evidence items, one a row: log-likelihood ratio, its sd and its reliability. */
export function itemsOf(t: DataTable): EvidenceItem[] {
  return Array.from({ length: t.rows }, (_, i) => ({
    label: `row ${i + 1}`, llr: t.values[0][i], sd: t.values[1][i], reliability: t.values[2][i],
  }));
}

// The verdict is what the evidence says as given: the prior log-odds plus every item's
// log-likelihood ratio, compared with zero. Each run perturbs it the way it could be wrong:
// every item holds up only with its reliability, and its strength wobbles by its standard
// deviation. The share of runs that reach the same verdict is its stability.
export const kernel: StochasticKernel<VerdictResult> = {
  palette: 'spectral',
  params: [
    // the input: seeded evidence items, and a reader's (ADR 0010)
    {
      kind: 'select', key: 'evidence', label: 'Evidence', value: 'seeded', rebuild: true,
      options: [{ value: 'seeded', label: 'Seeded evidence items' }],
    },
    { kind: 'range', key: 'k', label: 'Evidence items', min: 2, max: 12, step: 1, value: 7, rebuild: true },
    { kind: 'range', key: 'prior', label: 'Prior log-odds', min: -4, max: 4, step: 0.1, value: -1, rebuild: true },
    { kind: 'range', key: 'noise', label: 'Strength noise (× each item’s sd)', min: 0, max: 3, step: 0.1, value: 1, rebuild: true },
    { kind: 'range', key: 'n', label: 'Perturbed runs', min: 200, max: 40000, step: 200, value: 5000, rebuild: true },
    // from 0.05, not 0: an item that may never hold up (reliability 0) is not evidence
    {
      kind: 'range', key: 'minRel', label: 'Least item reliability', min: 0.05, max: 1, step: 0.05,
      value: MIN_RELIABILITY, rebuild: true,
      hint: 'Each item holds up with a reliability from this value to 0.4 above it, at most 1.',
    },
  ],
  chart: { title: 'Verdict stability as runs accumulate', x: { label: 'runs', log: true }, y: { label: 'share of runs agreeing' } },
  *run(ops, cfg, reader) {
    const s = new Sampler(() => ops.rnd());
    // a reader's evidence items (ADR 0010): perturbed as they are, in place of the seeded ones
    const mine = readerTable(cfg, 'evidence', reader);
    const k = mine ? mine.rows : num(cfg, 'k');
    const prior = num(cfg, 'prior');
    const noise = num(cfg, 'noise');
    const n = num(cfg, 'n');
    const items = mine ? itemsOf(mine) : evidenceSet(s, k, num(cfg, 'minRel'));
    const total = prior + items.reduce((t, e) => t + e.llr, 0);
    // a reader's log-odds may reach past ±8, and their items past ±2.5
    const reach = mine ? Math.max(HI, Math.abs(prior) + items.reduce((t, e) => t + Math.abs(e.llr), 0)) : HI;
    const lo0 = mine ? -reach : LO;
    const hi0 = reach;
    const wide = mine ? Math.max(2.5, ...items.map((e) => Math.abs(e.llr) + 2 * e.sd * noise)) : 2.5;
    const input: Stat[] = mine ? [readerInput(`${fmt(k)} evidence items`)] : [];
    const baseline = total > 0;
    // with no strength noise a run is decided by which items hold up: the exact stability sums
    // the chance of every such subset (2^k ≤ 4096 of them), with no draws
    const exact = noise ? null : exactStability(items, prior, baseline);
    // the histogram of posterior log-odds grows with the runs instead of being rebuilt
    const bins = new Array<number>(48).fill(0);
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
        histogram([lo], lo0, hi0, 48, 0, 1, bins);
        const same = lo > 0 === baseline;
        if (same) agree++;
        kept.forEach((h, i) => {
          if (!h) { dropped[i]++; if (!same) flipDropped[i]++; } else if (!same) flipKept[i]++;
        });
        if (done % 4000 === 3999) yield;
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
          kind: 'hist', title: 'Posterior log-odds over perturbed runs; verdict flips left of 0', lo: lo0, hi: hi0,
          bins: bins.slice(), shade: baseline ? [lo0, 0] : [0, hi0],
          marks: [{ x: 0, label: 'threshold', tone: -1 }, { x: total, label: 'as given', tone: 0.9, dash: true }],
        },
        {
          kind: 'bars', title: 'Items: log-likelihood ratio ± 2 sd × noise; label shows reliability', x: [-wide, wide],
          rows: items.map((e) => ({
            label: `${e.label} r=${fmt(e.reliability, 2)}`, lo: 0, hi: e.llr, tone: e.llr > 0 ? 0.85 : 0.1,
            ...(noise ? { err: [e.llr - 2 * e.sd * noise, e.llr + 2 * e.sd * noise] as [number, number] } : {}),
          })),
        },
      ], [
        ...input,
        { label: 'Verdict as given', value: `${baseline ? 'supported' : 'not supported'} (log-odds ${fmt(total, 2)})` },
        { label: 'Stability', value: `${pct(st)} ± ${pct(se)}` },
        { label: 'Runs', value: `${fmt(done)}; ${fmt(done - agree)} flipped` },
        { label: `Most influential: ${items[top].label}`, value: `flips ${fmt(100 * influence[top], 1)} percentage points more often when it fails` },
        ...(exact === null ? [] : [{ label: EXACT, value: pct(exact) }]),
      ]);
      yield;
    }
    return { items, prior, baseline, stability: agree / n, runs: n, noise };
  },
};
