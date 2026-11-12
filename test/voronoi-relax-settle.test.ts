// Lloyd's stained glass stops relaxing, so its readouts settle and the claims instrument (ADR 0007)
// can read them: it stops when the largest seed shift of a step falls below ε, or at a step budget,
// whichever comes first, and says which. The quantisation energy at the start sits next to the
// current one in one readout, so a claim can say that the energy fell.
import { describe, expect, it } from 'vitest';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ENERGY = 'quantisation energy, start → now';

const probe = (
  readout: string,
  params: Record<string, string | number | boolean> = {},
  seed?: number,
  expect: Claim['expect'] = { range: [-Number.MAX_VALUE, Number.MAX_VALUE] },
): Claim => ({
  id: 'settle', statement: `the ${readout} readout once settled`, readout, expect,
  setup: seed === undefined ? { params } : { params, seed },
});

describe('voronoi-relax stops relaxing', () => {
  it('has ε and step-budget parameters with defaults inside their ranges', async () => {
    const plate = await loadPlate('voronoi-relax');
    for (const key of ['epsilon', 'budget']) {
      const def = plate?.params.find((d) => d.key === key);
      expect(def?.kind, key).toBe('range');
      if (def?.kind !== 'range') return;
      expect(def.value, key).toBeGreaterThanOrEqual(def.min);
      expect(def.value, key).toBeLessThanOrEqual(def.max);
    }
  });

  for (const seed of [4242, 7]) {
    it(`settles at the defaults below ε, seed ${seed}, and the energy fell`, async () => {
      const stop = await read('voronoi-relax', probe('Stopped', {}, seed));
      expect(stop.reason).toBeUndefined();
      expect(stop.text).toMatch(/^settled: largest shift below ε/);

      // the claim an entry would make: start minus now, above zero
      const fell = await read('voronoi-relax',
        probe(ENERGY, {}, seed, { against: ENERGY, against_number: 2, above: 0 }));
      expect(fell.reason).toBeUndefined();
      expect(fell.value).toBeGreaterThan(0);
    }, 120_000);
  }

  it('stops at a tiny step budget and says so', async () => {
    const stop = await read('voronoi-relax', probe('Stopped', { budget: 10 }));
    expect(stop.reason).toBeUndefined();
    expect(stop.text).toMatch(/^step budget reached/);
    const steps = await read('voronoi-relax', probe('Lloyd iterations', { budget: 10 }));
    expect(steps.value).toBe(10);
  }, 120_000);
});
