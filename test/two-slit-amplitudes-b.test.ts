// The Aharonov–Bohm and single-slit experiments of two-slit-amplitudes, read through the plate: the
// enclosed flux from ∮A·dl is the solenoid's at every setting (Stokes), a whole flux quantum moves
// the fringes by a whole period, which looks like none, and half a quantum by half a period.
import { describe, expect, it } from 'vitest';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();
const claim = (readout: string, params: Record<string, unknown>): Claim => ({
  id: 'probe', statement: 'a probe of the plate', readout, expect: { value: 0 }, setup: { params: params as never, seed: 7 },
});

describe('two-slit-amplitudes B', () => {
  it('encloses the solenoid’s flux by the line integral of A, at any flux', async () => {
    for (const flux of [0.05, 0.7, 1.85]) {
      const r = await read('two-slit-amplitudes', claim('enclosed flux from ∮A·dl between the paths, in Φ₀', { scenario: 'flux', flux, n: 50 }));
      expect(Math.abs((r.value as number) - flux)).toBeLessThan(1e-5);
    }
  });

  it('a whole flux quantum shifts nothing visible, half a quantum shifts half a period', async () => {
    const whole = await read('two-slit-amplitudes', claim('fringe shift with the flux, fitted, in periods', { scenario: 'flux', flux: 1, n: 20000 }));
    expect(Math.abs(whole.value as number)).toBeLessThan(0.015);
    const half = await read('two-slit-amplitudes', claim('fringe shift with the flux, fitted, in periods', { scenario: 'flux', flux: 0.5, n: 20000 }));
    expect(0.5 - Math.abs(half.value as number)).toBeLessThan(0.015);
  });
});
