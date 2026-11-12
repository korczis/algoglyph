// The fm-synthesis plate: its measurement reads every sideband where sampling puts it (folded
// about 0 Hz and the Nyquist frequency, as the prediction does), and its carrier is a control
// whose default is the constant it replaced (2000 Hz).
import { describe, expect, it } from 'vitest';
import { predicted, sidebands } from '../src/kernels/signal/fm-synthesis';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

describe('fm-synthesis measurement reads folded sidebands', () => {
  // fm 250 Hz around the 2000 Hz carrier: order −9 sits at −250 Hz and order +9 at 4250 Hz,
  // above the 4096 Hz Nyquist frequency; sampled, they read at 250 Hz and 3942 Hz
  it('reads a sideband below 0 Hz and one above Nyquist in the bin they fold to', () => {
    for (const beta of [3, 6]) {
      const got = sidebands(250, beta, 10);
      const want = predicted(250, beta, 10);
      for (let i = 0; i < got.length; i++) {
        expect(Math.abs(got[i] - want[i]), `β ${beta} order ${i - 10}`).toBeLessThan(1e-9);
      }
    }
    // at β = 6 the folded orders are not empty: the measurement must find them, not read 0
    const want = predicted(250, 6, 10);
    expect(want[1], 'order −9').toBeGreaterThan(1e-3);
    expect(want[19], 'order +9').toBeGreaterThan(1e-3);
  });
});
