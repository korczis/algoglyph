// catalogue/entries/crawl-frontier.md: "no host was hit sooner than the delay after its previous
// fetch". The plate publishes the closest two hits on one host and the politeness delay as
// readouts of their own, so a claim can compare them; until now both lived only inside the
// `Result` sentence. The closest-hits readout must agree with the trace check in `Result`.
import { describe, expect, it } from 'vitest';
import { nthNumber, read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const probe = (readout: string, params: Record<string, number>): Claim => ({
  id: 'politeness', statement: 'no host is hit sooner than the politeness delay',
  readout, expect: { above: -1 }, setup: { params },
});

const SETTINGS: Record<string, number>[] = [
  {}, { politeness: 20, crawlers: 5 }, { politeness: 600, hosts: 2 }, { hosts: 6, crawlers: 1 },
];

describe('crawl-frontier politeness readouts', () => {
  for (const params of SETTINGS) {
    it(`publish the closest hits and the delay at ${JSON.stringify(params)}`, async () => {
      const delay = await read('crawl-frontier', probe('Politeness delay per host', params));
      expect(delay.reason).toBeUndefined();
      expect(delay.text).toBe(`${params.politeness ?? 180} ms`);

      const closest = await read('crawl-frontier', probe('Closest two hits on one host', params));
      expect(closest.reason).toBeUndefined();
      expect(closest.text).toMatch(/^[\d,]+ ms$/);
      expect(closest.value as number).toBeGreaterThanOrEqual(delay.value as number);

      // the same gap the trace check in `Result` measures ("... hits on one host N ms apart")
      const result = await read('crawl-frontier', probe('Result', params));
      const m = /closest two hits on one host ([\d,]+) ms apart/.exec(result.text ?? '');
      expect(m, `Result: ${result.text}`).not.toBeNull();
      expect(nthNumber((m as RegExpExecArray)[1], 1)).toBe(closest.value);
    }, 120_000);
  }
});
