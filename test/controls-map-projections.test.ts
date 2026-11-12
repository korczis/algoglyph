// The map-projections plate's fixed constants as controls: the southern edge of the graticule,
// the central-difference step H and the graticule step. Each default is the constant it
// replaced, round-trips through a shared link, and drives the readouts the way the projections'
// closed forms predict (Mercator's scale sec φ, the central differences' truncation error).
import { describe, expect, it } from 'vitest';
import { defaults, type ParamDef, type RangeParam, type SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { makeInput } from '../src/engines/geometry/input';
import { record } from '../src/engines/geometry/trace';
import { kernel } from '../src/kernels/geometry/map-projections';
import { loadPlate } from '../src/registry';
import { nthNumber, read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const D = Math.PI / 180;
const sec = (deg: number) => 1 / Math.cos(deg * D);

/** The kernel's counts at its defaults, recorded from map-projections.ts before any of its
 * constants became a control (abaf25a): integers, the same on every CPU. Its outcome is float64
 * from cos, tan and log, which may differ by an ulp between machines, so it is compared within
 * one run only. */
const DEFAULT_COUNTS = { proj: 3016, node: 754 };

type Result = { mercator: { kmin: number; kmax: number; conformal: number; angle: number }; krovak: { kmin: number } };

function run(params: Record<string, number | string> = {}) {
  return record(kernel, makeInput('none', 'none', 0, 4242), params, 4242, false);
}

const claim = (readout: string, params: Record<string, number | string>): Claim => ({
  id: 'probe', statement: '', readout, expect: { value: 0 }, setup: { params },
});

async function def(key: string): Promise<ParamDef | undefined> {
  const plate = await loadPlate('map-projections');
  return plate!.params.find((p) => p.key === key);
}

async function roundTrip(key: string, value: number | string): Promise<unknown> {
  const plate = await loadPlate('map-projections');
  const defs: ParamDef[] = plate!.params;
  const back = parse(defs, serialise(defs, { ...defaults(plate!), [key]: value }, 7));
  expect(back.seed).toBe(7);
  return back.params[key];
}

describe('map-projections defaults', () => {
  it('measure exactly what the fixed constants measured', () => {
    const explicit = run({ ...defaultsOfKernel() });
    const implicit = run();
    expect(explicit.counts).toEqual(DEFAULT_COUNTS);
    expect(explicit.outcome).toEqual(implicit.outcome);
    expect(explicit.counts).toEqual(implicit.counts);
  });
});

function defaultsOfKernel(): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const d of kernel.params ?? []) out[d.key] = d.value as number | string;
  return out;
}

describe('map-projections lat0 (southern edge)', () => {
  it('is a range control 40..60 by 0.5 whose default is the old constant 48.5', async () => {
    const d = (await def('lat0')) as RangeParam | undefined;
    expect(d).toBeDefined();
    expect({ kind: d!.kind, label: d!.label, min: d!.min, max: d!.max, step: d!.step, value: d!.value })
      .toEqual({ kind: 'range', label: 'Southern edge (° N)', min: 40, max: 60, step: 0.5, value: 48.5 });
  });

  it('round-trips through a shared link', async () => {
    expect(await roundTrip('lat0', 58)).toBe(58);
  });

  it('moves the band: Mercator\'s smallest k is sec lat0, its largest sec(lat0 + 3)', async () => {
    for (const lat0 of [40, 58]) {
      const r = run({ lat0 }).outcome.result as Result;
      // k is measured along the parallel, where Mercator's x is linear: exact up to rounding
      expect(Math.abs(r.mercator.kmin - sec(lat0)), `lat0=${lat0}`).toBeLessThan(1e-9);
      expect(Math.abs(r.mercator.kmax - sec(lat0 + 3)), `lat0=${lat0}`).toBeLessThan(1e-9);
      expect(r.mercator.angle, `lat0=${lat0}`).toBe(0);
    }
    const r = await read('map-projections', claim('Web Mercator scale k', { lat0: 58 }));
    expect(r.reason).toBeUndefined();
    expect(r.value).toBe(Number(sec(58).toFixed(4)));
    expect(nthNumber(r.text!, 2)).toBe(Number(sec(61).toFixed(4)));
  }, 120_000);
});

/** The central differences' truncation in h/k − 1 for Mercator at φ (degrees), step H (rad):
 * H²/6 · sec''(φ)/sec φ = H²/6 · (tan²φ + sec²φ), the first term of a series whose terms are all
 * positive, so a lower bound; the upper bound takes sec'' at φ + H (Lagrange remainder). */
const truncation = (phi: number, H: number) => (H * H) / 6 * (Math.tan(phi * D) ** 2 + sec(phi) ** 2);
const truncationUpper = (phi: number, H: number) => {
  const p = phi * D + H;
  return (H * H) / 6 * (Math.tan(p) ** 2 + 1 / Math.cos(p) ** 2) * (1 / Math.cos(p)) / sec(phi);
};

describe('map-projections h (difference step)', () => {
  it('is a select of 1e-6, 1e-5, 1e-4, 1e-3 rad whose default is the old constant 1e-5', async () => {
    const d = (await def('h')) as SelectParam | undefined;
    expect(d).toBeDefined();
    expect({ kind: d!.kind, label: d!.label, value: d!.value, options: d!.options.map((o) => o.value) })
      .toEqual({ kind: 'select', label: 'Difference step H (rad)', value: '1e-5', options: ['1e-6', '1e-5', '1e-4', '1e-3'] });
  });

  it('round-trips through a shared link', async () => {
    expect(await roundTrip('h', '1e-3')).toBe('1e-3');
  });

  it('drives Mercator\'s |h/k − 1| to the truncation bound H²/6 · (tan²φ + sec²φ) at 51.5° N', async () => {
    for (const h of ['1e-4', '1e-3']) {
      const H = Number(h);
      const r = run({ h }).outcome.result as Result;
      // rounding adds about eps/H, under 1e-11 at these steps
      expect(r.mercator.conformal, `H=${H}`).toBeGreaterThanOrEqual(truncation(51.5, H) - 1e-11);
      expect(r.mercator.conformal, `H=${H}`).toBeLessThanOrEqual(truncationUpper(51.5, H) + 1e-11);
      expect(r.mercator.angle, `H=${H}`).toBe(0);
    }
    const r = await read('map-projections', claim('Largest |h/k − 1|, Mercator / Křovák', { h: '1e-3' }));
    expect(r.reason).toBeUndefined();
    expect(r.value! >= 6.9e-7 && r.value! <= 7.0e-7, r.text).toBe(true);
  }, 120_000);
});

describe('map-projections step (graticule step)', () => {
  it('is a select of 0.25°, 0.5°, 1° whose default is the old constant 0.25°', async () => {
    const d = (await def('step')) as SelectParam | undefined;
    expect(d).toBeDefined();
    expect({ kind: d!.kind, label: d!.label, value: d!.value, options: d!.options.map((o) => o.value) })
      .toEqual({ kind: 'select', label: 'Graticule step (°)', value: '0.25', options: ['0.25', '0.5', '1'] });
  });

  it('round-trips through a shared link', async () => {
    expect(await roundTrip('step', '1')).toBe('1');
  });

  it('measures (3/s + 1)(7/s + 1) nodes per projection, Křovák\'s least k within d²/2R² of 0.9999', () => {
    // upper bounds in ppm from the cone's exact scale at half a node diagonal off the pseudo
    // standard parallel (16.7, 33.4, 66.8 km at 48.5° N), lower from 0.9999 less the Gaussian
    // sphere's 0.09 ppm below 1 over the band
    const bound: Record<string, number> = { 0.25: -96.55, 0.5: -86.19, 1: -44.3 };
    for (const step of ['0.25', '0.5', '1']) {
      const s = Number(step);
      const t = run({ step });
      expect(t.counts.node, `step=${step}`).toBe(2 * (3 / s + 1) * (7 / s + 1));
      const r = t.outcome.result as Result;
      const ppm = (r.krovak.kmin - 1) * 1e6;
      expect(ppm, `step=${step}`).toBeGreaterThanOrEqual(-100.1);
      expect(ppm, `step=${step}`).toBeLessThanOrEqual(bound[step]);
    }
  });
});
