import { num } from '../../core/plate';
import { fmt, pm, Sampler } from '../../engines/stochastic/sample';
import type { BarRow, StochasticKernel } from '../../engines/stochastic/trace';

export interface NoisyOrResult {
  links: number[];
  present: boolean[];
  leak: number;
  /** P(H | the present causes), by the noisy-OR recurrence. */
  exact: number;
  estimate: number;
  se: number;
  samples: number;
}

/** Noisy-OR by the recurrence q <- q + (1 - q) p over the present causes, from the leak. */
export function noisyOr(leak: number, links: number[], present: boolean[]): number {
  let q = leak;
  links.forEach((p, i) => { if (present[i]) q += (1 - q) * p; });
  return q;
}

const FRAMES = 140;

// Each present cause, on its own, brings the effect about with its link probability, and the
// causes fail independently; the effect is absent only when the leak and every present cause
// all fail. The Monte Carlo run simulates exactly that generative story.
export const kernel: StochasticKernel<NoisyOrResult> = {
  palette: 'phosphor',
  params: [
    { kind: 'range', key: 'k', label: 'Possible causes', min: 2, max: 10, step: 1, value: 6, rebuild: true },
    { kind: 'range', key: 'leak', label: 'Leak (effect with no cause)', min: 0, max: 0.3, step: 0.01, value: 0.05, rebuild: true },
    { kind: 'range', key: 'n', label: 'Simulated cases', min: 500, max: 50000, step: 500, value: 6000, rebuild: true },
  ],
  chart: { title: 'Simulated frequency against the noisy-OR value', x: { label: 'simulated cases', log: true }, y: { label: 'P(effect)' } },
  *run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const k = num(cfg, 'k');
    const leak = num(cfg, 'leak');
    const n = num(cfg, 'n');
    const links = Array.from({ length: k }, () => 0.05 + 0.55 * s.uniform());
    const present = links.map(() => s.bernoulli(0.6));
    const exact = noisyOr(leak, links, present);
    const rows: BarRow[] = [{ label: 'leak', lo: 0, hi: leak, tone: 0.2 }];
    let q = leak;
    links.forEach((p, i) => {
      const next = present[i] ? q + (1 - q) * p : q;
      rows.push({ label: `E${i + 1} p=${fmt(p, 2)}${present[i] ? '' : ' (absent)'}`, lo: q, hi: next, tone: present[i] ? 0.4 + (0.5 * i) / k : 0.05 });
      q = next;
    });
    let hits = 0;
    let done = 0;
    const band: [number, number, number][] = [];
    for (let f = 1; f <= FRAMES; f++) {
      const end = Math.round(n * Math.pow(f / FRAMES, 2));
      for (; done < end; done++) {
        let effect = s.bernoulli(leak);
        for (let i = 0; i < k; i++) if (present[i] && s.bernoulli(links[i])) effect = true;
        ops.count(1);
        if (effect) hits++;
        if (done % 5000 === 4999) yield;
      }
      if (!done) continue;
      const est = hits / done;
      const se = Math.sqrt(Math.max(est * (1 - est), 1e-9) / done);
      ops.point('simulated frequency', done, est);
      ops.point('noisy-OR value', done, exact);
      band.push([Math.log10(done), est - 2 * se, est + 2 * se]);
      ops.frame([
        { kind: 'bars', title: 'How each present cause raises P(effect)', x: [0, 1], rows: [...rows, { label: 'combined', lo: 0, hi: exact, tone: 0.95, mark: est }] },
        {
          kind: 'plot', title: 'Simulated frequency ± 2 SE (x: log10 cases)', x: [Math.log10(Math.max(1, n / 2000)), Math.log10(n)], y: [Math.max(0, exact - 0.25), Math.min(1, exact + 0.25)],
          band: { pts: band.slice(), tone: 0.5 },
          lines: [{ pts: band.map(([x, lo, hi]) => [x, (lo + hi) / 2]), tone: 0.8, weight: 2 }],
          marks: [{ y: exact, label: 'noisy-OR', tone: -1, dash: true }],
        },
      ], [
        { label: 'Noisy-OR P(effect)', value: fmt(exact, 4) },
        { label: 'Simulated frequency', value: pm(est, se, 4) },
        { label: 'Simulated cases', value: fmt(done) },
        { label: 'Present causes', value: `${fmt(present.filter(Boolean).length)} of ${fmt(k)}` },
      ]);
      yield;
    }
    const est = hits / n;
    return { links, present, leak, exact, estimate: est, se: Math.sqrt(est * (1 - est) / n), samples: n };
  },
};
