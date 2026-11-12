// catalogue/entries/critical-path.md: the backward pass "fills each task", and tasks with no slack
// are then marked. Once both passes are complete every task has had both, so "Both passes done"
// must read n of n, while the critical tasks stay marked.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import { nthNumber, read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const probe = (readout: string, seed: number): Claim => ({
  id: 'critical-path-readout', statement: `the plate publishes "${readout}"`, readout,
  expect: { range: [0, 1e12] }, setup: { seed },
});

describe('critical-path settled readouts', () => {
  for (const seed of [7, DEFAULT_SEED]) {
    it(`count every task done once both passes are complete (seed ${seed})`, async () => {
      const r = await read('critical-path', probe('Both passes done', seed));
      expect(r.reason).toBeUndefined();
      const text = r.text ?? '';
      expect(nthNumber(text, 1), `readout text: ${text}`).toBe(nthNumber(text, 2));
      expect(nthNumber(text, 2)).toBeGreaterThan(0);
      const marked = await read('critical-path', probe('Critical (no slack)', seed));
      expect(marked.reason).toBeUndefined();
      expect(marked.value).toBeGreaterThan(0);
    }, 120_000);
  }
});
