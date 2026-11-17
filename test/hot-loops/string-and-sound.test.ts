// string-and-sound steps its string with leapfrog1d (src/plates/_shared/wave2d/leapfrog.ts), whose
// flush call was inlined against a local TINY (scripts/check-hot-loops.mjs); the kernel's own code
// is unchanged. Its run, for every option, is compared with the kernel and stencil as they were
// (test/fixtures/hot-loops-before, frozen together): every number of every panel, step and chart
// equal (typed arrays byte for byte), within one run. The kernel never asks for the flushed
// branch, so leapfrog1d itself is also stepped with `flushed` and a damping sponge on both
// float widths until its field decays through the subnormal range, every step bit-equal.
// Planted changes (C² and the damping nudged) must fail the same comparisons.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { NumericKernel } from '../../src/engines/numeric/trace';
import { mulberry32 } from '../../src/core/random';
import { kernel as before } from '../fixtures/hot-loops-before/src/kernels/numeric/string-and-sound';
import { leapfrog1d as stepBefore } from '../fixtures/hot-loops-before/src/plates/_shared/wave2d/leapfrog';
import { kernel as now } from '../../src/kernels/numeric/string-and-sound';
import { leapfrog1d as stepNow } from '../../src/plates/_shared/wave2d/leapfrog';

/** A run as text: numbers exactly (−0 and NaN kept), typed arrays by a hash of their bytes. */
const text = (v: unknown) => JSON.stringify(v, (_k, x: unknown) => {
  if (typeof x === 'number' && (Object.is(x, -0) || !Number.isFinite(x))) return `#${String(Object.is(x, -0) ? '-0' : x)}`;
  if (ArrayBuffer.isView(x)) return `${x.constructor.name} ${createHash('sha256').update(new Uint8Array(x.buffer, x.byteOffset, x.byteLength)).digest('hex')}`;
  return x;
});
const run = (k: NumericKernel, params: Record<string, string>) => text(k.run({ seed: 4242, params }));

type Field = Float32Array | Float64Array;
/** leapfrog1d stepped `steps` times, flushed, through a sponge: every stored field as bytes. */
function decay(step: typeof stepNow, Arr: Float32ArrayConstructor | Float64ArrayConstructor, c2: number, k: number, flushed = true, steps = 3000): string[] {
  const n = 257;
  const rnd = mulberry32(7);
  const fields = [new Arr(n), new Arr(n), new Arr(n)] as Field[];
  for (let i = 1; i < n - 1; i++) { fields[0][i] = rnd() - 0.5; fields[1][i] = fields[0][i] * 0.99; }
  const damp = new Arr(n);
  for (let i = 0; i < n; i++) damp[i] = k + (1 - k) * Math.abs(i / (n - 1) - 0.5);
  const out: string[] = [];
  for (let s = 0; s < steps; s++) {
    const [u, prev, nxt] = fields;
    step(u, prev, nxt, n, c2, damp, flushed);
    out.push(createHash('sha256').update(new Uint8Array(nxt.buffer)).digest('hex'));
    fields[0] = nxt; fields[1] = u; fields[2] = prev;
  }
  return out;
}

describe('string-and-sound: leapfrog1d without an imported call per cell', () => {
  it('runs exactly what the kernel and stencil before ran, for every option', () => {
    for (const c2 of ['1', '0.5', '0.25']) {
      for (const pluck of ['0.5', '0.333333', '0.25', '0.2']) {
        expect(run(now, { c2, pluck }), `${c2} ${pluck}`).toBe(run(before, { c2, pluck }));
      }
    }
  }, 120_000);

  it('steps the flushed, damped line bit-equal to the stencil before, on both float widths, into the subnormal range', () => {
    for (const Arr of [Float64Array, Float32Array]) {
      const a = decay(stepNow, Arr, 0.9, 0.6);
      expect(a).toEqual(decay(stepBefore, Arr, 0.9, 0.6));
      // the run reached the flush: it stored other values than the same run unflushed
      expect(a).not.toEqual(decay(stepNow, Arr, 0.9, 0.6, false));
    }
  }, 120_000);

  it('planted changes (C² of the kernel, the sponge of the stencil) fail the same comparisons', () => {
    expect(run(now, { c2: '0.5', pluck: '0.2' })).not.toBe(run(before, { c2: '1', pluck: '0.2' }));
    expect(decay(stepNow, Float64Array, 0.9, 0.61)).not.toEqual(decay(stepBefore, Float64Array, 0.9, 0.6));
  }, 120_000);
});
