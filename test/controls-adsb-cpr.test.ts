// The adsb-cpr plate: the seconds of flight between two reports is a control whose default is
// the constant it replaced (8 s), and within the 10 s pairing limit the decoded position's error
// is the newest frame's own 17-bit quantisation, whatever the gap.
import { describe, expect, it } from 'vitest';
import { defaults, type RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { Meter, recordAll } from '../src/engines/signal/trace';
import { NL } from '../src/kernels/signal/_adsb';
import { haversine, kernel } from '../src/kernels/signal/adsb-cpr';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const PLATE = 'adsb-cpr';
const SPEED = 240; // m/s, the plate's aircraft
const M_PER_DEG = (6371008.8 * Math.PI) / 180;
const probe = (readout: string, params: Record<string, number>, expect: Claim['expect']): Claim =>
  ({ id: 'probe', statement: '', readout, expect, setup: { params } });

/**
 * The largest error a correctly zoned fix can have at latitude `lat`: half a 17-bit step of the
 * odd frame's latitude zone (360/59°, the wider) and of its longitude zone (360/(NL − 1)°),
 * in metres.
 */
function quantisation(lat: number): number {
  const dLat = ((360 / 59) / 2 ** 18) * M_PER_DEG;
  const dLon = ((360 / Math.max(1, NL(lat) - 1)) / 2 ** 18) * M_PER_DEG * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

const pair = (s: string) => s.split(',').map(Number) as [number, number];

describe('adsb-cpr gap between reports', () => {
  it('is a range 1..10 s in steps of 1 whose default is the old constant 8', async () => {
    const plate = await loadPlate(PLATE);
    const d = plate!.params.find((p) => p.key === 'gap') as RangeParam | undefined;
    expect(d).toBeDefined();
    expect(d!.kind).toBe('range');
    expect(d!.label).toBe('Seconds between even and odd');
    expect([d!.min, d!.max, d!.step, d!.value]).toEqual([1, 10, 1, 8]);
  });

  it('round-trips through a shared link', async () => {
    const plate = await loadPlate(PLATE);
    for (const gap of [1, 10, 3]) {
      const want = { ...defaults(plate!), gap };
      const back = parse(plate!.params, serialise(plate!.params, want, 7));
      expect(back.seed).toBe(7);
      expect(back.params.gap).toBe(gap);
    }
  });

  it('flies gap · 240 m between reports, and each fix within its quantisation bound', () => {
    for (const gap of [1, 10]) {
      const views = recordAll(kernel.run({ snr: 11, gap }, 4242, new Meter()));
      const truth = views.map((v) => pair(v.stats.find((s) => s.label === 'True position')!.value));
      for (let k = 1; k < truth.length; k++) {
        const d = haversine({ lat: truth[k][0], lon: truth[k][1] }, { lat: truth[k - 1][0], lon: truth[k - 1][1] });
        // the step is laid off in degrees, so the great circle is a hair shorter or longer, and
        // the readout shows 5 decimals: ±0.5·10⁻⁵° is ±0.56 m in each coordinate of each end,
        // at most 2·0.56·√2 = 1.58 m on the distance
        expect(Math.abs(d - SPEED * gap), `gap ${gap} step ${k}`).toBeLessThan(1e-3 * SPEED * gap + 1.6);
      }
      let fixes = 0;
      for (const v of views) {
        const err = v.stats.find((s) => s.label === 'Decoding error')!.value;
        if (err === '—') continue;
        fixes++;
        const lat = pair(v.stats.find((s) => s.label === 'True position')!.value)[0];
        expect(Number.parseFloat(err), `gap ${gap}`).toBeLessThanOrEqual(quantisation(lat) + 0.01);
      }
      expect(fixes).toBeGreaterThan(20);
    }
  });

  // Budget, counted: the gap moves the aircraft further between reports, never the work; the
  // run sends, receives and checks the same 24 frames at every gap
  it('does the same work at every gap', () => {
    const counts = (gap: number) => {
      const views = recordAll(kernel.run({ snr: 4, gap }, 4242, new Meter()));
      return { views: views.length, counts: views[views.length - 1].counts };
    };
    const base = counts(8);
    expect(counts(1)).toEqual(base);
    expect(counts(10)).toEqual(base);
  });

  for (const gap of [1, 10]) {
    it(`keeps the mean error below 5 m at ${gap} s`, async () => {
      const r = await read(PLATE, probe('Mean error over decoded fixes', { gap }, { below: 5 }));
      expect(r.reason).toBeUndefined();
      expect(r.value).toBeLessThan(5);
    }, 120_000);
  }
});
