import { num } from '../../core/plate';
import type { SystemsKernel } from '../../engines/systems/sim';
import { happenedBefore, history, workers, type ClockRule, type HEvent } from './_history';

// Each worker keeps one counter: +1 for a local or send event, and on receipt one past the
// larger of its own and the message's. The counters then never contradict happened-before.
export const LAMPORT: ClockRule<number> = {
  zero: () => 0,
  tick: (c) => c + 1,
  merge: (c, m) => Math.max(c, m) + 1,
  label: (c) => String(c),
  size: () => 1,
};

export interface Pairs { causal: number; concurrent: number; bad: number }
export interface LamportResult { events: HEvent<number>[]; pairs?: Pairs }

/** Every pair of events against happened-before: causal ones, those out of order, concurrent ones. */
export function recount(events: HEvent<number>[]): Pairs {
  const hb = happenedBefore(events);
  let causal = 0; let concurrent = 0; let bad = 0;
  for (let b = 0; b < events.length; b++) {
    for (let a = 0; a < b; a++) {
      if (hb[b][a]) { causal++; if (events[a].clock >= events[b].clock) bad++; } else concurrent++;
    }
  }
  return { causal, concurrent, bad };
}

export const kernel: SystemsKernel<LamportResult> = {
  params: [{ kind: 'range', key: 'procs', label: 'Workers', min: 2, max: 6, step: 1, value: 4, rebuild: true }],
  setup: (p) => ({ lanes: workers(num(p, 'procs')), horizon: 3000, net: { delay: [20, 260] } }),
  install(net, p) {
    let max = 0;
    const events = history(net, num(p, 'procs'), LAMPORT, (e) => {
      max = Math.max(max, e.clock);
      net.gauge('max', max);
      net.sample(`worker ${e.proc + 1}`, e.clock);
    });
    const res: LamportResult = { events };
    // the workload stops acting at 0.9 of the horizon and its last receipt lands before it ends,
    // so the pairs are recounted once, over the whole history, when the run reaches its horizon
    net.at(net.horizon, () => {
      res.pairs = recount(events);
      net.count('pairs.inverted', res.pairs.bad);
      net.count('pairs.concurrent', res.pairs.concurrent);
    });
    return res;
  },
  readouts: [
    { key: 'events', label: 'Events' },
    { key: 'events.send', label: 'Messages' },
    { key: 'max', kind: 'gauge', label: 'Largest timestamp' },
    { key: 'clock.ints', label: 'Clock integers carried' },
    { key: 'pairs.inverted', label: 'Causal pairs out of order' },
    { key: 'pairs.concurrent', label: 'Concurrent pairs given an order' },
  ],
  chart: { title: 'Lamport timestamp of each worker', y: 'timestamp' },
  verdict(r) {
    const { causal, concurrent, bad } = r.pairs ??= recount(r.events);
    return bad ? `${bad} causal pairs out of order`
      : `respects all ${causal} causal pairs; ${concurrent} concurrent pairs get an order anyway`;
  },
};
