// catalogue/entries/ticket-lock-semaphore.md: "Workers are therefore served strictly in the order
// they drew tickets". The plate publishes how many lock grants broke that order, and the number
// must be a count of the run's grants, equal to a recount made here from every hold's ticket and
// grant time, not a constant.
import { describe, expect, it } from 'vitest';
import { defaultParams, simulate, total, type SystemsKernel } from '../src/engines/systems/sim';
import { kernel, type LockResult } from '../src/kernels/systems/ticket-lock-semaphore';
import { read } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const LABEL = 'Lock grants out of ticket order';
const k = kernel as SystemsKernel<LockResult>;

/** Grants, in the order they were made, whose ticket is not the one after the previous grant's. */
function outOfOrder(r: LockResult): number {
  const granted = r.lock.filter((h) => !Number.isNaN(h.granted)).sort((a, b) => a.granted - b.granted);
  let bad = 0;
  granted.forEach((h, i) => { if (h.ticket !== (i ? (granted[i - 1].ticket as number) + 1 : 0)) bad++; });
  return bad;
}

describe('ticket-lock-semaphore readouts', () => {
  it('publish the lock grants out of ticket order', async () => {
    const r = await read('ticket-lock-semaphore', {
      id: 'ticket-order', statement: `the plate publishes "${LABEL}"`, readout: LABEL, expect: { range: [0, 1e12] },
    });
    expect(r.reason).toBeUndefined();
    expect(r.value).toBe(0);
  }, 120_000);

  it('count them from the grant log of every run, which a recount confirms', () => {
    const row = k.readouts.find((d) => d.label === LABEL);
    expect(row, `${LABEL} is a readout`).toBeDefined();
    for (const seed of [1, 2, 3, 5, 8, 13, 4242]) for (const workers of [2, 5, 8]) {
      const run = simulate(k, defaultParams(k, { workers }), seed);
      expect(run.result.lock.filter((h) => !Number.isNaN(h.granted)).length).toBeGreaterThan(workers);
      expect(total(run.net, (row as { key: string }).key), `seed ${seed}, ${workers} workers`).toBe(outOfOrder(run.result));
    }
  });
});
