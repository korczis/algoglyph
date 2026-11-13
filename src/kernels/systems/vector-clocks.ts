import { num } from '../../core/plate';
import type { SystemsKernel } from '../../engines/systems/sim';
import { history, localShareParam, workers, type ClockRule, type HEvent } from './_history';

// One counter per worker: a worker advances its own entry, and on receipt takes the entrywise
// maximum first. Event a happened before b exactly when a's vector is <= b's and differs.
export const VECTOR: ClockRule<number[]> = {
  zero: (n) => new Array(n).fill(0),
  tick: (c, i) => { const v = c.slice(); v[i]++; return v; },
  merge: (c, m, i) => { const v = c.map((x, k) => Math.max(x, m[k])); v[i]++; return v; },
  label: (c) => `[${c.join(',')}]`,
  size: (n) => n,
};

export type Relation = 'before' | 'after' | 'equal' | 'concurrent';

export function compare(a: number[], b: number[]): Relation {
  let le = true; let ge = true;
  for (let k = 0; k < a.length; k++) {
    if (a[k] > b[k]) le = false;
    if (a[k] < b[k]) ge = false;
  }
  if (le && ge) return 'equal';
  if (le) return 'before';
  if (ge) return 'after';
  return 'concurrent';
}

export interface VectorResult { events: HEvent<number[]>[] }

export const kernel: SystemsKernel<VectorResult> = {
  params: [
    { kind: 'range', key: 'procs', label: 'Workers', min: 2, max: 6, step: 1, value: 4, rebuild: true },
    localShareParam(),
  ],
  setup: (p) => ({ lanes: workers(num(p, 'procs')), horizon: 3000, net: { delay: [20, 260] } }),
  install(net, p) {
    const events = history(net, num(p, 'procs'), VECTOR, (e, all) => {
      let conc = 0;
      for (let k = 0; k < e.id; k++) if (compare(all[k].clock, e.clock) === 'concurrent') conc++;
      net.count('pairs.concurrent', conc);
      net.count('pairs.ordered', e.id - conc);
      net.sample(`worker ${e.proc + 1}`, e.clock.reduce((s, x) => s + x, 0));
    }, num(p, 'localShare') / 100);
    return { events };
  },
  readouts: [
    { key: 'events', label: 'Events' },
    { key: 'events.send', label: 'Messages' },
    { key: 'pairs.ordered', label: 'Pairs ordered by causality' },
    { key: 'pairs.concurrent', label: 'Pairs detected concurrent' },
    { key: 'clock.ints', label: 'Clock integers carried' },
  ],
  chart: { title: 'Events each worker knows of (sum of its vector)', y: 'events known' },
  verdict({ events }) {
    let conc = 0;
    for (let b = 0; b < events.length; b++) {
      for (let a = 0; a < b; a++) if (compare(events[a].clock, events[b].clock) === 'concurrent') conc++;
    }
    return `${conc} of ${(events.length * (events.length - 1)) / 2} pairs concurrent`;
  },
};
