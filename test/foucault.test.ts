import { describe, expect, it } from 'vitest';
import { EARTH_OMEGA, PrecessionMeter, rk4, type State } from '../src/plates/foucault-pendulum/foucault';

const W0 = (2 * Math.PI) / 2.4;
const DT = 1 / 240;

function measure(latDeg: number, boost: number, seconds: number, amp = 0.1): number {
  const wz = EARTH_OMEGA * boost * Math.sin((latDeg * Math.PI) / 180);
  let s: State = [amp, 0, 0, 0];
  const meter = new PrecessionMeter();
  for (let t = DT; t <= seconds; t += DT) {
    s = rk4(s, DT, W0, wz);
    meter.sample(t, s[0], s[1]);
  }
  return meter.rate();
}

describe('foucault pendulum', () => {
  for (const lat of [30, 48.85, 90, -45]) {
    it(`precesses at −Ω·sin(latitude) within 2 % at ${lat}°`, () => {
      const theory = -EARTH_OMEGA * 3000 * Math.sin((lat * Math.PI) / 180);
      const rate = measure(lat, 3000, 60);
      expect(Math.abs((rate - theory) / theory)).toBeLessThan(0.02);
    });
  }

  it('does not precess on the equator', () => {
    expect(Math.abs(measure(0, 3000, 60))).toBeLessThan(1e-6);
  });

  it('the northern hemisphere turns clockwise from above (negative rate)', () => {
    expect(measure(48.85, 3000, 30)).toBeLessThan(0);
    expect(measure(-48.85, 3000, 30)).toBeGreaterThan(0);
  });

  it('a full turn in Paris takes about 31.8 hours on the real Earth', () => {
    const hours = (2 * Math.PI) / (EARTH_OMEGA * Math.sin((48.85 * Math.PI) / 180)) / 3600;
    expect(hours).toBeCloseTo(31.8, 1);
  });
});
