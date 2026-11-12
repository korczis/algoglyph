// The haversine-hhi plate's firm size spread σ: a control whose default is the constant it
// replaced (weight = exp(1.1 · gaussian)), which round-trips through a shared link and drives the
// rings' concentration readouts the way the Herfindahl–Hirschman index predicts.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { defaults, type ParamDef, type RangeParam } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import { DEFAULT_SHAPES, firms, makeInput, CENTRE } from '../src/engines/geometry/input';
import type { InputKind } from '../src/engines/geometry/trace';
import { loadPlate } from '../src/registry';
import { read, nthNumber, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

// Every geometry input at its defaults, over a few sizes and seeds, compared within one run: with
// no params against the control's default passed explicitly. A hash recorded on one machine is no
// guard: inputs carry float64 from sin, cos and exp, which may differ by an ulp on another CPU.
function defaultInputsHash(extra: Record<string, number> = {}): string {
  const h = createHash('sha256');
  for (const [kind, shapes] of Object.entries(DEFAULT_SHAPES)) {
    for (const shape of shapes) {
      for (const n of [2, 3, 60, 120, 400]) {
        for (const seed of [1, 4242, 4302]) {
          h.update(JSON.stringify(makeInput(kind as InputKind, shape, n, seed, { ...extra })));
        }
      }
    }
  }
  return h.digest('hex');
}

const claim = (readout: string, params: Record<string, number>, against?: number): Claim => ({
  id: 'probe', statement: '', readout,
  expect: against ? { against: readout, against_number: against, tolerance: 0 } : { value: 0 },
  setup: { params },
});

describe('haversine-hhi spread', () => {
  it('is a range control 0..2 by 0.1 whose default is the old constant 1.1', async () => {
    const plate = await loadPlate('haversine-hhi');
    const d = plate!.params.find((p) => p.key === 'spread') as RangeParam | undefined;
    expect(d).toBeDefined();
    const { kind, label, min, max, step, value } = d!;
    expect({ kind, label, min, max, step, value })
      .toEqual({ kind: 'range', label: 'Firm size spread σ', min: 0, max: 2, step: 0.1,
        value: 1.1 });
  });

  it('round-trips through a shared link', async () => {
    const plate = await loadPlate('haversine-hhi');
    const defs: ParamDef[] = plate!.params;
    const want = { ...defaults(plate!), spread: 0.4 };
    const back = parse(defs, serialise(defs, want, 7));
    expect(back.seed).toBe(7);
    expect(back.params.spread).toBe(0.4);
  });

  it('leaves every geometry input bit-identical at its default', () => {
    expect(defaultInputsHash({ spread: 1.1 })).toBe(defaultInputsHash());
    // the plate passes its default explicitly: the same firms, the same draws after them
    const a = makeInput('firms', 'firms', 60, 4242, {});
    const b = makeInput('firms', 'firms', 60, 4242, { spread: 1.1 });
    expect(b).toEqual(a);
  });

  it('draws the same numbers at σ = 0, every firm of size 1', () => {
    let calls0 = 0;
    let calls1 = 0;
    const r0 = mulberry32(9);
    const r1 = mulberry32(9);
    const f0 = firms(50, CENTRE, () => { calls0++; return r0(); }, 0);
    const f1 = firms(50, CENTRE, () => { calls1++; return r1(); });
    expect(calls0).toBe(calls1);
    expect(f0.every((f) => f.weight === 1)).toBe(true);
    expect(f0.map((f) => [f.lat, f.lon])).toEqual(f1.map((f) => [f.lat, f.lon]));
  });

  it('at σ = 0 a ring of k firms has HHI 10000 / k, so k equal-size equivalents', async () => {
    for (const ring of ['Within 10 km', 'Within 60 km']) {
      const r = await read('haversine-hhi', claim(ring, { spread: 0 }, 3));
      expect(r.reason, ring).toBeUndefined();
      expect(r.value, `${ring}: ${r.text}`).toBe(0);
      const k = nthNumber(r.text!, 1)!;
      expect(nthNumber(r.text!, 2), r.text).toBe(Math.round(10000 / k));
    }
  }, 120_000);

  it('at σ = 2, 10000 / k ≤ HHI ≤ 10000 for the 60 km ring of all 60 firms', async () => {
    const r = await read('haversine-hhi', claim('Within 60 km', { spread: 2 }));
    expect(r.reason).toBeUndefined();
    const k = nthNumber(r.text!, 1)!;
    const hhi = nthNumber(r.text!, 2)!;
    const eq = nthNumber(r.text!, 3)!;
    expect(k).toBe(60);
    expect(hhi).toBeGreaterThanOrEqual(Math.round(10000 / k));
    expect(hhi).toBeLessThanOrEqual(10000);
    expect(eq).toBeLessThanOrEqual(k);
    expect(eq).toBeGreaterThanOrEqual(1);
    // and the spread is felt: unequal sizes concentrate the ring
    expect(eq).toBeLessThan(k);
  }, 120_000);
});
