// The map-projections plate's fixed constants as controls: the southern edge of the graticule,
// the central-difference step H and the graticule step. Each default is the constant it
// replaced, round-trips through a shared link, and drives the readouts the way the projections'
// closed forms predict (Mercator's scale sec φ, the central differences' truncation error).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { defaults, type ParamDef, type RangeParam } from '../src/core/plate';
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

/** sha256 of the kernel's outcome and counts at its default parameters, recorded from
 * map-projections.ts before any of its constants became a control (abaf25a). */
const DEFAULT_OUTCOME_SHA256 = 'bbdddd780735f9db2256c11f3d389c26aa7615b1e403d3b12918771204464dec';

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
    const t = run({ ...defaultsOfKernel() });
    const h = createHash('sha256').update(JSON.stringify({ outcome: t.outcome, counts: t.counts })).digest('hex');
    expect(h).toBe(DEFAULT_OUTCOME_SHA256);
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
