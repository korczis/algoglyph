// The backoff's base and cap become controls (S3 B5): every client slept min(1,600, 100 · 2^k)
// ms after its k-th failed attempt (the lockstep cohort exactly that, the jitter cohort a uniform
// time below it); now min(cap, base · 2^k) for the controls `base` and `cap`, whose defaults 100
// and 1,600 are the old constants. A smaller base or cap means more retries, so each range starts
// at its default. Checked, per control: it exists with its range, it travels in a shared link,
// and it drives the run (the lockstep sleeps are exactly the capped ceiling, the jitter sleeps
// below it, and the retries readout counts the run's retries); and the default run is the run
// recorded before the controls existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { defaultParams, simulate, type SystemsKernel } from '../src/engines/systems/sim';
import { kernel, type BackoffResult, type Cohort } from '../src/kernels/systems/backoff-jitter';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'backoff-jitter';
const k = kernel as SystemsKernel<BackoffResult>;
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { above: -1 }, setup: { params: params as Record<string, number> } });
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);
const retries = (c: Cohort) => c.attempts.reduce((s, a) => s + Math.max(0, a.length - 1), 0);

/** The sleeps of one run against the capped ceiling min(cap, base · 2^k). */
function checkSleeps(r: BackoffResult, base: number, cap: number, at: string) {
  expect(r.lockstep.delays.length, at).toBeGreaterThan(0);
  for (const d of r.lockstep.delays) expect(d.sleep, at).toBe(Math.min(cap, base * 2 ** d.attempt));
  for (const d of r.jitter.delays) {
    expect(d.sleep, at).toBeGreaterThanOrEqual(0);
    expect(d.sleep, at).toBeLessThan(Math.min(cap, base * 2 ** d.attempt));
  }
}

function control(key: string, want: Omit<RangeParam, 'kind' | 'key' | 'rebuild'>, other: (v: number) => [number, number]) {
  describe(`backoff-jitter: ${want.label}`, () => {
    it('is a range control, the old constant its default', async () => {
      const full = { kind: 'range', key, ...want, rebuild: true };
      expect(k.params?.find((d) => d.key === key)).toEqual(full);
      const plate = await loadPlate(ID)!;
      expect(plate.params.find((d) => d.key === key)).toEqual(full);
    });

    it('round-trips through a shared link', async () => {
      const defs = (await loadPlate(ID)!).params;
      const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
      for (const v of [want.min + want.step, want.max]) {
        expect(parse(defs, serialise(defs, { ...d, [key]: v }, 7))).toEqual({ seed: 7, params: { [key]: v } });
      }
    });

    it('sets the capped ceiling the clients sleep by, at every setting', () => {
      const d = k.params!.find((x) => x.key === key) as RangeParam;
      for (const v of settings(d)) {
        const [base, cap] = other(v);
        for (const clients of [5, 40, 80]) {
          for (const seed of [1, 4242]) {
            const r = simulate(k, defaultParams(k, { clients, [key]: v }), seed).result;
            checkSleeps(r, base, cap, `${key} ${v} clients ${clients} seed ${seed}`);
          }
        }
      }
    });

    it('drives the retries readouts', async () => {
      for (const v of [want.min + want.step, want.max]) {
        const { result } = simulate(k, defaultParams(k, { [key]: v }), 4242);
        for (const [label, c] of [['Lockstep: retries', result.lockstep], ['Jitter: retries', result.jitter]] as const) {
          const r = await read(ID, claim(label, { [key]: v }));
          expect(r.reason).toBeUndefined();
          expect(r.value, `${label} at ${key} ${v}`).toBe(retries(c));
        }
      }
    });
  });
}

control('base', { label: 'Backoff base (ms)', min: 100, max: 400, step: 50, value: 100 }, (v) => [v, 1600]);

describe('backoff-jitter at its defaults is what it was before the controls', () => {
  // recorded on the code before the controls existed (main 23b65ad); the run draws only uniform
  // numbers and multiplies by powers of two (no sin, cos, log or exp), so its trace is the same
  // on every platform
  const TRACE = '0fbd458e17e79281';

  it('records the same trace for every seed and cohort size', () => {
    const all = [5, 40, 80].flatMap((clients) =>
      [1, 2, 3, 4242].map((seed) => hash(simulate(k, defaultParams(k, { clients }), seed).net.events)));
    expect(hash(all)).toBe(TRACE);
  });
});
