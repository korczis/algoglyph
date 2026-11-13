// page-hinkley (catalogue/entries/page-hinkley.md): "An alarm is raised the first time the climb
// exceeds λ." The highest climb so far, the peak of m_t − min m, is a readout of its own, so that a
// claim can say how far below λ a stationary stream stays; it is the largest statistic the run
// computed, recomputed here.
import { describe, expect, it } from 'vitest';
import { trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import { kernel, type PageHinkleyResult } from '../src/kernels/stochastic/page-hinkley';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'page-hinkley';
const k = kernel as StochasticKernel<PageHinkleyResult>;
const probe = (readout: string, params: Record<string, number>, seed: number): Claim =>
  ({ id: 'probe', statement: 'a readout test reading', readout, expect: { above: -1 }, setup: { params, seed } });

describe('page-hinkley: the peak of m_t − min m is a readout', () => {
  for (const params of [{}, { shift: 0 }, { shift: 0.4, n: 2000 }, { shift: 3, lambda: 60 }] as Record<string, number>[]) {
    it(`reads the largest statistic of the run at ${JSON.stringify(params)}`, async () => {
      for (const seed of [4242, 7]) {
        const r = await read(ID, probe('Peak of m_t − min m', params, seed));
        expect(r.reason, `seed ${seed}`).toBeUndefined();
        const res = trace(k, params, seed).result!;
        expect(r.value, `seed ${seed}: ${r.text}`).toBe(Number(Math.max(...res.statistic).toFixed(2)));
      }
    });
  }
});
