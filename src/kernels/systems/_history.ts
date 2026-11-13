// A generic message-passing workload for logical clocks: each worker performs local events and
// sends to random peers at random intervals; every receipt is an event too. The clock rule is
// pluggable, so Lamport and vector clocks run on the very same history for one seed.
import type { ParamDef } from '../../core/plate';
import type { Net } from '../../engines/systems/sim';

export interface HEvent<C> {
  id: number;
  proc: number;
  kind: 'local' | 'send' | 'recv';
  t: number;
  clock: C;
  /** For a receipt: the id of the send event it receives. */
  from?: number;
}

export interface ClockRule<C> {
  zero(n: number): C;
  /** Advance for a local or send event at process i. */
  tick(c: C, i: number): C;
  /** Combine with a received clock at process i. */
  merge(c: C, m: C, i: number): C;
  label(c: C): string;
  /** Integers a message carries. */
  size(n: number): number;
}

const TONE = { local: 0.45, send: 0.72, recv: 0.95 } as const;

/** The share of a worker's steps that are local events, the rest being sends, as a percentage.
 * Both clock kernels declare it from here, so they stay in step; its default 30 is the old
 * fixed 0.3, and 30 / 100 === 0.3, so the default run draws the same numbers. */
export const localShareParam = (): ParamDef => ({
  kind: 'range', key: 'localShare', label: 'Local steps (%)', min: 30, max: 100, step: 10, value: 30, rebuild: true,
});

export const workers = (n: number) => Array.from({ length: n }, (_, i) => `worker ${i + 1}`);

/** Install the workload on `net`; `onEvent` sees each event as it happens. A step is a local
 * event with probability `local` (0..1) and a send to a random peer otherwise. */
export function history<C>(net: Net, n: number, rule: ClockRule<C>,
  onEvent: (e: HEvent<C>, all: HEvent<C>[]) => void = () => {}, local = 0.3): HEvent<C>[] {
  const clocks = Array.from({ length: n }, () => rule.zero(n));
  const events: HEvent<C>[] = [];
  const mean = 160;
  const add = (proc: number, kind: HEvent<C>['kind'], clock: C, from?: number) => {
    const e: HEvent<C> = { id: events.length, proc, kind, t: net.now, clock, from };
    events.push(e);
    net.count('events');
    net.count(`events.${kind}`);
    net.mark(proc, rule.label(clock), TONE[kind]);
    onEvent(e, events);
    return e;
  };
  const act = (i: number) => {
    if (net.now > net.horizon * 0.9) return;
    clocks[i] = rule.tick(clocks[i], i);
    if (n < 2 || net.rnd() < local) add(i, 'local', clocks[i]);
    else {
      let j = Math.floor(net.rnd() * (n - 1));
      if (j >= i) j++;
      const s = add(i, 'send', clocks[i]);
      const carried = clocks[i];
      net.count('clock.ints', rule.size(n));
      net.send(i, j, 'm', () => {
        clocks[j] = rule.merge(clocks[j], carried, j);
        add(j, 'recv', clocks[j], s.id);
      });
    }
    net.after(-mean * Math.log(1 - net.rnd()) + 1, () => act(i));
  };
  for (let i = 0; i < n; i++) net.after(net.uniform(0, mean), () => act(i));
  return events;
}

/**
 * Happened-before as bit sets: hb[e] holds every event that happened before e, built in one
 * pass over the history in time order from program order and send-to-receipt edges.
 */
export function happenedBefore<C>(events: HEvent<C>[]): Uint8Array[] {
  const m = events.length;
  const hb: Uint8Array[] = [];
  const lastOf = new Map<number, number>();
  for (const e of events) {
    const row = new Uint8Array(m);
    const merge = (k: number) => { row[k] = 1; const r = hb[k]; for (let x = 0; x < k; x++) if (r[x]) row[x] = 1; };
    const prev = lastOf.get(e.proc);
    if (prev !== undefined) merge(prev);
    if (e.from !== undefined) merge(e.from);
    hb.push(row);
    lastOf.set(e.proc, e.id);
  }
  return hb;
}
