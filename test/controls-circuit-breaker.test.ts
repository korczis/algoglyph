// The circuit breaker's recovery time becomes a control (S3 B1): the dependency degraded over the
// fixed window [1,500, 4,200) ms; now over [1,500, recover) for the control `recover`, whose
// default 4,200 is the old constant. Checked: the control exists with its range, it travels in a
// shared link, it drives what the plate reads (the dependency recovers at `recover`, the trips
// stay within one per cooldown over the degraded window, the breaker closes again), and the
// default run is the run recorded before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { defaultParams, simulate, type SystemsKernel } from '../src/engines/systems/sim';
import { kernel, type BreakerResult } from '../src/kernels/systems/circuit-breaker';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'circuit-breaker';
const KEY = 'recover';
const START = 1500;
const HORIZON = 7000;
/** The longest a forwarded call takes to come back: dependency 5..30 ms, answer 2..10 ms, rounded up. */
const LATE = 50;
const k = kernel as SystemsKernel<BreakerResult>;
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { above: -1 }, setup: { params: params as Record<string, number> } });

/** The trips the claim allows: at least one, at most one per cooldown over [1,500, recover + 50). */
const tripBound = (recover: number, cooldown: number) => 1 + Math.floor((recover + LATE - START) / cooldown);

describe('circuit-breaker: dependency recovers at', () => {
  it('is a range control, the old constant its default', async () => {
    const want = { kind: 'range', key: KEY, label: 'Dependency recovers at (ms)', min: 2000, max: 6000, step: 100, value: 4200, rebuild: true };
    expect(k.params?.find((d) => d.key === KEY)).toEqual(want);
    const plate = await loadPlate(ID)!;
    expect(plate.params.find((d) => d.key === KEY)).toEqual(want);
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID)!).params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [2000, 3100, 6000]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('ends the degraded stretch at its value, at every setting', () => {
    const d = k.params!.find((x) => x.key === KEY) as RangeParam;
    for (let r = d.min; r <= d.max; r += d.step) {
      for (const seed of [1, 4242]) {
        const { net } = simulate(k, defaultParams(k, { [KEY]: r }), seed);
        const dep = net.events.flatMap((e) => (e.k === 'state' && e.lane === 2 ? [[e.t, e.state]] : []));
        expect(dep, `recover ${r}`).toEqual([[0, ''], [START, 'degraded'], [r, '']]);
      }
    }
  });

  it('drives the trips and the recoveries', async () => {
    for (const r of [2000, 3000, 6000]) {
      // the close-after-recovery claim needs a trial after the last cooldown: recover + 500 + 50 < 7,000
      expect(r + 500 + LATE).toBeLessThan(HORIZON);
      const trips = await read(ID, claim('Trips (to open)', { [KEY]: r }));
      expect(trips.reason).toBeUndefined();
      expect(trips.value!, `recover ${r}`).toBeGreaterThanOrEqual(1);
      expect(trips.value!, `recover ${r}`).toBeLessThanOrEqual(tripBound(r, 500));
      const rec = await read(ID, claim('Recoveries (to closed)', { [KEY]: r }));
      expect(rec.value!, `recover ${r}`).toBeGreaterThan(0);
      const open = await read(ID, claim('Calls forwarded while open', { [KEY]: r }));
      expect(open.value, `recover ${r}`).toBe(0);
    }
  });
});

describe('circuit-breaker at its defaults is what it was before the control', () => {
  // recorded on the code before the control existed (main 23b65ad); the run draws only uniform
  // numbers (no sin, cos, log or exp), so its trace is the same on every platform
  const TRACE = '03a940276f559dd6';

  it('records the same trace for every seed', () => {
    const all = [1, 2, 3, 4242].map((seed) => hash(simulate(k, defaultParams(k), seed).net.events));
    expect(hash(all)).toBe(TRACE);
  });
});
