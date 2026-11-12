// The token bucket's run length becomes a control (S3 B2): the run was a fixed 6,000 ms; now it
// lasts T seconds for the control `duration`, whose default 6 is the old constant. Checked: the
// control exists with its range, it travels in a shared link, it drives what the plate reads
// (no request after T, admissions within rate × T + burst, a flood admitting from rate × T), and
// the default run is the run recorded before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { defaultParams, simulate, total, type Ev, type SystemsKernel } from '../src/engines/systems/sim';
import { kernel, type BucketResult } from '../src/kernels/systems/token-bucket';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'token-bucket';
const KEY = 'duration';
const k = kernel as SystemsKernel<BucketResult>;
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { above: -1 }, setup: { params: params as Record<string, number> } });
const FLOOD = { rate: 12, burst: 8, load: 120 };

/** An event without its times and float values: what is the same on every platform when the
 * run's timings come from Math.log (rule 9 of the brief: integers and strings only). */
const shape = (e: Ev) => {
  if (e.k === 'msg') return [e.k, e.from, e.to, e.label, e.fate];
  if (e.k === 'gauge') return [e.k, e.key];
  if (e.k === 'sample') return [e.k, e.series, e.value];
  if (e.k === 'count') return [e.k, e.key, e.by];
  if (e.k === 'state') return [e.k, e.lane, e.state];
  return [e.k, e.lane, e.label];
};

describe('token-bucket: run length', () => {
  it('is a range control, the old constant its default', async () => {
    const want = { kind: 'range', key: KEY, label: 'Run length (s)', min: 2, max: 12, step: 1, value: 6, rebuild: true };
    expect(k.params?.find((d) => d.key === KEY)).toEqual(want);
    const plate = await loadPlate(ID)!;
    expect(plate.params.find((d) => d.key === KEY)).toEqual(want);
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID)!).params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [2, 5, 12]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('ends the run at T and admits at most rate × T + burst, at every setting', () => {
    const d = k.params!.find((x) => x.key === KEY) as RangeParam;
    for (let T = d.min; T <= d.max; T += d.step) {
      for (const seed of [1, 2, 4242]) {
        for (const over of [{}, FLOOD]) {
          const { net, result, setup } = simulate(k, defaultParams(k, { ...over, [KEY]: T }), seed);
          expect(setup.horizon, `T ${T}`).toBe(T * 1000);
          expect(Math.max(...result.arrivals.map((a) => a.t)), `T ${T}`).toBeLessThanOrEqual(T * 1000);
          const admitted = total(net, 'admitted');
          expect(admitted, `T ${T} seed ${seed}`).toBe(result.arrivals.filter((a) => a.admitted).length);
          expect(admitted, `T ${T} seed ${seed}`).toBeLessThanOrEqual(result.rate * T + result.burst);
          if (over === FLOOD) expect(admitted, `flood T ${T} seed ${seed}`).toBeGreaterThanOrEqual(result.rate * T);
        }
      }
    }
  });

  it('drives the Admitted readout under a flood', async () => {
    for (const T of [2, 4, 12]) {
      const r = await read(ID, claim('Admitted', { ...FLOOD, [KEY]: T }));
      expect(r.reason).toBeUndefined();
      expect(r.value!, `T ${T}`).toBeGreaterThanOrEqual(12 * T);
      expect(r.value!, `T ${T}`).toBeLessThanOrEqual(12 * T + 8);
    }
  });
});

describe('token-bucket at its defaults is what it was before the control', () => {
  // recorded on the code before the control existed (main 23b65ad), over the trace's integers
  // and strings only, since the arrival gaps are drawn through Math.log
  const TRACE = 'b665f944c8d38a0d';

  it('records the same trace for every seed', () => {
    const all = [1, 2, 3, 4242].flatMap((seed) => [{}, FLOOD].map((over) =>
      hash(simulate(k, defaultParams(k, over), seed).net.events.map(shape))));
    expect(hash(all)).toBe(TRACE);
  });
});
