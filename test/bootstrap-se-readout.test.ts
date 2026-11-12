// catalogue/entries/bootstrap-ci.md: "The readout compares the bootstrap standard error with s/√n."
// The settled readouts (after the repeated experiments) must still carry that comparison for the
// sample shown, not only the first resampling frames.
import { describe, expect, it } from 'vitest';
import { firstNumber, read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const probe: Claim = {
  id: 'bootstrap-se', statement: 'the settled plate compares the bootstrap standard error with s/√n',
  readout: 'Bootstrap standard error', expect: { above: 0 },
};

describe('bootstrap-ci settled readouts', () => {
  it('still publish the bootstrap standard error next to s/√n', async () => {
    const r = await read('bootstrap-ci', probe);
    expect(r.reason).toBeUndefined();
    const se = r.value as number;
    expect(se).toBeGreaterThan(0);
    const m = /s\/√n\s*([-−]?\d[\d,]*(?:\.\d+)?)/.exec(r.text ?? '');
    expect(m, `readout text: ${r.text}`).not.toBeNull();
    const plugIn = firstNumber((m as RegExpExecArray)[1]) as number;
    expect(plugIn).toBeGreaterThan(0);
    // the bootstrap SE estimates s/√n·√((n−1)/n); B = 1000 resamples put it within a few percent
    expect(se / plugIn).toBeGreaterThan(0.8);
    expect(se / plugIn).toBeLessThan(1.2);
  }, 120_000);
});
