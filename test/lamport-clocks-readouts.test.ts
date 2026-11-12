// catalogue/entries/lamport-clocks.md: "If a happened before b ... then a's timestamp is smaller"
// and "The converse fails: a smaller timestamp says nothing about causality." The plate publishes
// both as readouts, and each must equal a recount of the run's pairs made here, against a
// happened-before found by graph search over program order and message edges.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { defaultParams, simulate, type SystemsKernel } from '../src/engines/systems/sim';
import type { HEvent } from '../src/kernels/systems/_history';
import { kernel } from '../src/kernels/systems/lamport-clocks';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const probe = (readout: string): Claim => ({
  id: 'lamport-readout', statement: `the plate publishes "${readout}"`, readout, expect: { range: [0, 1e12] },
});

/** For every event, the events reachable from it (it happened before them), by depth-first search. */
function reach(events: HEvent<number>[]): boolean[][] {
  const next: number[][] = events.map(() => []);
  const last = new Map<number, number>();
  for (const e of events) {
    const prev = last.get(e.proc);
    if (prev !== undefined) next[prev].push(e.id);
    if (e.from !== undefined) next[e.from].push(e.id);
    last.set(e.proc, e.id);
  }
  return events.map((e) => {
    const seen = new Array<boolean>(events.length).fill(false);
    const stack = [...next[e.id]];
    while (stack.length) {
      const x = stack.pop() as number;
      if (seen[x]) continue;
      seen[x] = true;
      stack.push(...next[x]);
    }
    return seen;
  });
}

describe('lamport-clocks readouts', () => {
  it('count the causal pairs out of order and the concurrent pairs, as a recount of the run', async () => {
    const k = kernel as SystemsKernel<{ events: HEvent<number>[] }>;
    const { events } = simulate(k, defaultParams(k), DEFAULT_SEED).result;
    const hb = reach(events);
    let inverted = 0; let concurrent = 0;
    for (let b = 0; b < events.length; b++) {
      for (let a = 0; a < b; a++) {
        if (hb[a][b]) { if (events[a].clock >= events[b].clock) inverted++; } else if (!hb[b][a]) concurrent++;
      }
    }
    expect(concurrent).toBeGreaterThan(0);

    const bad = await read('lamport-clocks', probe('Causal pairs out of order'));
    expect(bad.reason).toBeUndefined();
    expect(bad.value).toBe(inverted);
    expect(bad.value).toBe(0);

    const conc = await read('lamport-clocks', probe('Concurrent pairs given an order'));
    expect(conc.reason).toBeUndefined();
    expect(conc.value).toBe(concurrent);
  }, 120_000);
});
