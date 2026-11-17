// dispersive-waves steps its line with leapfrog1d (src/plates/_shared/wave2d/leapfrog.ts), whose
// flush call was inlined against a local TINY (scripts/check-hot-loops.mjs); the kernel's own code
// is unchanged. Its run, for every option, is compared with the kernel and stencil as they were
// (test/fixtures/hot-loops-before, frozen together): every number of every panel, step and chart
// equal (typed arrays byte for byte), within one run. The flushed branch itself is proved in
// test/hot-loops/string-and-sound.test.ts. A planted change (C² nudged) must fail the comparison.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { NumericKernel } from '../../src/engines/numeric/trace';
import { C2S, K0S, kernel as now } from '../../src/kernels/numeric/dispersive-waves';
import { kernel as before } from '../fixtures/hot-loops-before/src/kernels/numeric/dispersive-waves';

const text = (v: unknown) => JSON.stringify(v, (_k, x: unknown) => {
  if (typeof x === 'number' && (Object.is(x, -0) || !Number.isFinite(x))) return `#${String(Object.is(x, -0) ? '-0' : x)}`;
  if (ArrayBuffer.isView(x)) return `${x.constructor.name} ${createHash('sha256').update(new Uint8Array(x.buffer, x.byteOffset, x.byteLength)).digest('hex')}`;
  return x;
});
const run = (k: NumericKernel, params: Record<string, string>) => text(k.run({ seed: 4242, params }));

describe('dispersive-waves: leapfrog1d without an imported call per cell', () => {
  it('runs exactly what the kernel and stencil before ran, for every option', () => {
    for (const experiment of ['packet', 'beats']) {
      for (const k0 of K0S) {
        for (const c2 of C2S) {
          const p = { experiment, k0, c2 };
          expect(run(now, p), JSON.stringify(p)).toBe(run(before, p));
        }
      }
    }
  }, 120_000);

  it('a planted change (C² nudged) fails the same comparison', () => {
    expect(run(now, { experiment: 'packet', k0: '1.6', c2: '0.25' })).not.toBe(run(before, { experiment: 'packet', k0: '1.6', c2: '0.5' }));
  }, 120_000);
});
