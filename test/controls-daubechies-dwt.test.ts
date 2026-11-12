// The daubechies-dwt plate: the signal's length is a control whose default is the constant it
// replaced (512 samples). Reconstruction stays exact to a rounding bound derived from the filter
// length, the levels and n, and the run's multiplies are counted exactly at every length.
import { describe, expect, it } from 'vitest';
import { defaults, type SelectParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { Meter, MUL, recordAll } from '../src/engines/signal/trace';
import { FILTERS, kernel } from '../src/kernels/signal/daubechies-dwt';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const PLATE = 'daubechies-dwt';
const probe = (readout: string, params: Record<string, number | string>, expect: Claim['expect']): Claim =>
  ({ id: 'probe', statement: '', readout, expect, setup: { params } });

/**
 * The rounding bound of a J-level transform and its inverse on n samples with a filter of length
 * L. Each level is orthogonal; its computed outputs are sums of at most 2L products, off by at
 * most γ = 2L·u times the same sums taken in absolute value, whose matrix has 2-norm at most
 * ‖h‖₁ ≤ √L (Schur's test: every row and column of |h| and |g| sums to ‖h‖₁). Orthogonal steps
 * carry an error on unchanged, so J levels there and J back add at most 2J·2L·u·√L·‖x‖₂, and
 * ‖x‖₂ ≤ √n·‖x‖∞ with ‖x‖∞ ≤ 1 + 0.8 + 0.6 = 2.4 for the plate's sine, step and burst.
 */
const U = 2 ** -53;
const rounding = (n: number, L: number, J: number) => 2 * J * 2 * L * U * Math.sqrt(L) * Math.sqrt(n) * 2.4;

/** The multiplies the run meters: the analysis, the full reconstruction and the compressed one
 * each cost n·L at the first level and half that at each next, 2nL(1 − 2^−J) apiece. */
const multiplies = (n: number, L: number, J: number) => 3 * 2 * n * L * (1 - 2 ** -J);

describe('daubechies-dwt signal length', () => {
  it('is a select of 128, 256 and 512 samples whose default is the old constant 512', async () => {
    const plate = await loadPlate(PLATE);
    const d = plate!.params.find((p) => p.key === 'n') as SelectParam | undefined;
    expect(d).toBeDefined();
    expect(d!.kind).toBe('select');
    expect(d!.label).toBe('Signal length');
    expect(d!.value).toBe('512');
    expect(d!.options.map((o) => o.value)).toEqual(['128', '256', '512']);
  });

  it('round-trips through a shared link', async () => {
    const plate = await loadPlate(PLATE);
    for (const n of ['128', '256']) {
      const want = { ...defaults(plate!), n };
      const back = parse(plate!.params, serialise(plate!.params, want, 7));
      expect(back.seed).toBe(7);
      expect(back.params.n).toBe(n);
    }
  });

  // rule 7: the survey's 6NL(1 − 2^−J) is checked against counted runs before any claim states it
  it('meters exactly 6nL(1 − 2^−J) multiplies, at every length, wavelet and level count', () => {
    for (const n of [128, 256, 512]) {
      for (const [id, f] of Object.entries(FILTERS)) {
        for (const levels of [1, 3, 6]) {
          const views = recordAll(kernel.run({ wavelet: id, levels, keep: 8, n: String(n) }, 1, new Meter()));
          const last = views[views.length - 1];
          expect(last.counts[MUL], `${id} n ${n} J ${levels}`).toBe(multiplies(n, f.h.length, levels));
          expect(last.stats.find((s) => s.label === 'Coefficients kept')!.value).toBe(`${Math.max(1, Math.round(0.08 * n))} of ${n}`);
        }
      }
    }
  });

  it('reconstructs within the rounding bound at every length, wavelet and level count', () => {
    for (const n of [128, 256, 512]) {
      for (const [id, f] of Object.entries(FILTERS)) {
        for (const levels of [1, 6]) {
          const views = recordAll(kernel.run({ wavelet: id, levels, keep: 8, n: String(n) }, 1, new Meter()));
          const worst = Number(views[views.length - 1].stats.find((s) => s.label.startsWith('Perfect'))!.value);
          expect(worst, `${id} n ${n} J ${levels}`).toBeLessThan(rounding(n, f.h.length, levels));
        }
      }
    }
  });

  for (const n of ['128', '256']) {
    it(`reads the bound and the count at ${n} samples`, async () => {
      const L = FILTERS.db2.h.length;
      const err = await read(PLATE, probe('Perfect reconstruction, largest error', { n }, { below: rounding(Number(n), L, 5) }));
      expect(err.reason).toBeUndefined();
      expect(err.value).toBeLessThan(rounding(Number(n), L, 5));
      const mul = await read(PLATE, probe(MUL, { n }, { value: multiplies(Number(n), L, 5) }));
      expect(mul.reason).toBeUndefined();
      expect(mul.value).toBe(multiplies(Number(n), L, 5));
    }, 120_000);
  }
});
