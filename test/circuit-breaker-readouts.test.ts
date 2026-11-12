// catalogue/entries/circuit-breaker.md: no call is forwarded while the breaker is open. The plate
// publishes that count as its own readout, `Calls forwarded while open`, so a claim can pin it
// at 0; the trace check (the `Result` readout) must agree with it on every setting.
import { describe, expect, it } from 'vitest';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const probe = (readout: string, params: Record<string, number> = {}): Claim => ({
  id: 'forwarded-while-open', statement: 'no call is forwarded while the breaker is open',
  readout, expect: { value: 0 }, setup: { params },
});

const SETTINGS: Record<string, number>[] = [
  {}, { threshold: 1, cooldown: 100 }, { threshold: 12, cooldown: 2000 },
];

describe('circuit-breaker Calls forwarded while open', () => {
  for (const params of SETTINGS) {
    it(`is published and 0 at ${JSON.stringify(params)}`, async () => {
      const r = await read('circuit-breaker', probe('Calls forwarded while open', params));
      expect(r.reason).toBeUndefined();
      expect(r.text).toBe('0');
      expect(r.value).toBe(0);
      // the trace, replayed independently of the state machine, finds no leak either
      const verdict = await read('circuit-breaker', { ...probe('Result', params), expect: { above: -1 } });
      expect(verdict.text).toMatch(/no call forwarded while open/);
    }, 120_000);
  }
});
