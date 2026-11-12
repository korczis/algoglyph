// The k-means-plus-plus plate's Lloyd iteration cap as a control: its default is the constant it
// replaced (100), it round-trips through a shared link, and a cap below the converged count stops
// the run there, says so, and keeps the exact count of distance computations.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { defaults, type ParamDef, type RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { makeInput } from '../src/engines/geometry/input';
import { record } from '../src/engines/geometry/trace';
import { kernel } from '../src/kernels/geometry/k-means-plus-plus';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const SEEDS = [4242, 7, 1];

/** sha256 of the kernel's outcomes and counts at its default parameters over every shape, a few
 * sizes, k and seeds, recorded from k-means-plus-plus.ts before its cap became a control (abaf25a). */
const DEFAULT_OUTCOMES_SHA256 = '611cfee341d2c3a91cc9e8de219c3024c6b98b3b9dc6da748832392cec442fb9';

const claim = (readout: string, params: Record<string, number>): Claim => ({
  id: 'probe', statement: '', readout, expect: { value: 0 }, setup: { params },
});

type Result = { inertia: number[] };

describe('k-means-plus-plus defaults', () => {
  it('draw and measure exactly what the fixed cap did', () => {
    const h = createHash('sha256');
    for (const shape of ['clustered', 'uniform', 'disk']) {
      for (const n of [10, 400]) {
        for (const k of [2, 5, 12]) {
          for (const seed of SEEDS) {
            const t = record(kernel, makeInput('points', shape, n, seed, { k }), { k, maxIter: 100 }, seed, false);
            h.update(JSON.stringify({ outcome: t.outcome, counts: t.counts }));
          }
        }
      }
    }
    expect(h.digest('hex')).toBe(DEFAULT_OUTCOMES_SHA256);
  });
});

describe('k-means-plus-plus maxIter (Lloyd iteration cap)', () => {
  it('is a range control 1..100 by 1 whose default is the old constant 100', async () => {
    const plate = await loadPlate('k-means-plus-plus');
    const d = plate!.params.find((p) => p.key === 'maxIter') as RangeParam | undefined;
    expect(d).toBeDefined();
    expect({ kind: d!.kind, label: d!.label, min: d!.min, max: d!.max, step: d!.step, value: d!.value })
      .toEqual({ kind: 'range', label: 'Lloyd iteration cap', min: 1, max: 100, step: 1, value: 100 });
  });

  it('round-trips through a shared link', async () => {
    const plate = await loadPlate('k-means-plus-plus');
    const defs: ParamDef[] = plate!.params;
    const back = parse(defs, serialise(defs, { ...defaults(plate!), maxIter: 7 }, 7));
    expect(back.seed).toBe(7);
    expect(back.params.maxIter).toBe(7);
  });

  it('stops at min(cap, converged): the same first iterations, (k − 1)n + nk per iteration', () => {
    let capped = 0;
    for (const shape of ['clustered', 'uniform', 'disk']) {
      for (const n of [50, 400]) {
        for (const k of [2, 5, 12]) {
          for (const seed of SEEDS) {
            const input = makeInput('points', shape, n, seed, { k });
            const m = input.points.length;
            const kk = Math.min(m, k);
            const full = record(kernel, input, { k }, seed, true);
            const converged = full.counts.iter;
            for (const maxIter of [1, 2, 3, converged]) {
              const t = record(kernel, input, { k, maxIter }, seed, true);
              const at = `${shape} n=${n} k=${k} seed=${seed} cap=${maxIter} converged=${converged}`;
              expect(t.counts.iter, at).toBe(Math.min(maxIter, converged));
              expect(t.counts.dist, at).toBe((kk - 1) * m + m * kk * t.counts.iter);
              expect((t.outcome.result as Result).inertia, at)
                .toEqual((full.outcome.result as Result).inertia.slice(0, t.counts.iter));
              const note = t.frames[t.frames.length - 1].note;
              if (maxIter < converged) { capped++; expect(note, at).toMatch(/stopped at the cap/); } else expect(note, at).toMatch(/^converged/);
            }
          }
        }
      }
    }
    expect(capped).toBeGreaterThan(0);
  });

  it('at a cap of 2, below the default run\'s converged count, the readout reads 2 and says so', async () => {
    const full = await read('k-means-plus-plus', claim('Iterations to converge', {}));
    expect(full.reason).toBeUndefined();
    expect(full.value!).toBeGreaterThan(2);
    const r = await read('k-means-plus-plus', claim('Iterations to converge', { maxIter: 2 }));
    expect(r.reason).toBeUndefined();
    expect(r.value).toBe(2);
    expect(r.text).toMatch(/cap/);
  }, 120_000);
});
