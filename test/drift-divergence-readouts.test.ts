// drift-divergence (catalogue/entries/drift-divergence.md): "The population stability index
// Σ(q − p) ln(q/p) is exactly the sum of the two Kullback–Leibler divergences, KL(q‖p) + KL(p‖q)".
// The two directions and their sum are a readout of their own, "a + b = s nats", so that a claim
// can set PSI against it; each number is recomputed here from the run's binned proportions.
import { describe, expect, it } from 'vitest';
import { trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import { kernel, type DriftResult } from '../src/kernels/stochastic/drift-divergence';
import { nthNumber, read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'drift-divergence';
const probe = (readout: string, params: Record<string, number>, seed: number): Claim =>
  ({ id: 'probe', statement: 'a readout test reading', readout, expect: { above: -1 }, setup: { params, seed } });
const kl = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * Math.log(x / b[i]), 0);
const round4 = (x: number) => Number(x.toFixed(4));

describe('drift-divergence: KL both ways is a readout', () => {
  for (const params of [{}, { drift: 0, widen: 0 }, { n: 20000, drift: 3, widen: 1.5 }] as Record<string, number>[]) {
    it(`reads KL(q‖p) + KL(p‖q) = PSI at ${JSON.stringify(params)}`, async () => {
      for (const seed of [4242, 7]) {
        const r = await read(ID, probe('KL both ways', params, seed));
        expect(r.reason, `seed ${seed}`).toBeUndefined();
        const text = r.text ?? '';
        const res = trace(kernel as StochasticKernel<DriftResult>, params, seed).result!;
        const last = res.steps[res.steps.length - 1];
        expect(nthNumber(text, 1), text).toBe(round4(kl(last.q, last.p)));
        expect(nthNumber(text, 2), text).toBe(round4(kl(last.p, last.q)));
        expect(nthNumber(text, 3), text).toBe(round4(kl(last.q, last.p) + kl(last.p, last.q)));
        const forward = await read(ID, probe('KL(current ‖ reference)', params, seed));
        expect(nthNumber(text, 1)).toBe(forward.value);
        const psi = await read(ID, probe('PSI', params, seed));
        expect(Math.abs((nthNumber(text, 3) as number) - (psi.value as number))).toBeLessThanOrEqual(1e-4);
      }
    });
  }
});
