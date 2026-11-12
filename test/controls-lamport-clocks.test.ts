// The share of local steps in the logical-clock workload becomes a control (S3 B4): a worker's
// step was a local event with the fixed probability 0.3 and a send otherwise; now with the
// probability localShare / 100, whose default 30 is the old constant (30 / 100 === 0.3, so the
// default draws the same numbers). Lamport and vector clocks run the one workload
// (src/kernels/systems/_history.ts) and declare the control from one factory. Checked: the
// control exists with its range on both, it travels in a shared link, it drives what the plate
// reads (one integer per message, no causal pair out of order, and at 100% no message at all, so
// every pair of events on different workers is concurrent), and the default run is the run
// recorded before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { defaultParams, simulate, total, type Ev, type SystemsKernel } from '../src/engines/systems/sim';
import { kernel, recount, type LamportResult } from '../src/kernels/systems/lamport-clocks';
import { kernel as vector } from '../src/kernels/systems/vector-clocks';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'lamport-clocks';
const KEY = 'localShare';
const k = kernel as SystemsKernel<LamportResult>;
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params, expect: Claim['expect'] = { above: -1 }): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });
const pairs = (m: number) => (m * (m - 1)) / 2;

/** An event without its times: the workload's gaps are drawn through Math.log, so only the
 * trace's integers and strings are the same on every platform (rule 9 of the brief). */
const shape = (e: Ev) => {
  if (e.k === 'msg') return [e.k, e.from, e.to, e.label, e.fate];
  if (e.k === 'gauge') return [e.k, e.key, e.value];
  if (e.k === 'sample') return [e.k, e.series, e.value];
  if (e.k === 'count') return [e.k, e.key, e.by];
  if (e.k === 'state') return [e.k, e.lane, e.state];
  return [e.k, e.lane, e.label];
};

describe('lamport-clocks: local steps', () => {
  it('is a range control, the old constant its default, declared as the vector clocks do', async () => {
    const want = { kind: 'range', key: KEY, label: 'Local steps (%)', min: 30, max: 100, step: 10, value: 30, rebuild: true };
    expect(k.params?.find((d) => d.key === KEY)).toEqual(want);
    expect(vector.params, 'one factory for both kernels').toEqual(k.params);
    const plate = await loadPlate(ID)!;
    expect(plate.params.find((d) => d.key === KEY)).toEqual(want);
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID)!).params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [40, 70, 100]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('keeps one integer per message and the causal order at every setting; at 100% sends nothing', () => {
    const d = k.params!.find((x) => x.key === KEY) as RangeParam;
    for (let share = d.min; share <= d.max; share += d.step) {
      for (const procs of [2, 4, 6]) {
        for (const seed of [1, 4242]) {
          const { net, result } = simulate(k, defaultParams(k, { procs, [KEY]: share }), seed);
          const at = `share ${share} procs ${procs} seed ${seed}`;
          const events = result.events;
          const sends = total(net, 'events.send');
          expect(total(net, 'clock.ints'), at).toBe(sends);
          const p = recount(events);
          expect(p.bad, at).toBe(0);
          expect(p.causal + p.concurrent, at).toBe(pairs(events.length));
          if (share === 100) {
            expect(sends, at).toBe(0);
            expect(events.every((e) => e.kind === 'local'), at).toBe(true);
            // only program order remains: the pairs on one worker are causal, every other is concurrent
            const per = Array.from({ length: procs }, (_, i) => events.filter((e) => e.proc === i).length);
            const same = per.reduce((s, e) => s + pairs(e), 0);
            expect(p.causal, at).toBe(same);
            expect(p.concurrent, at).toBe(pairs(events.length) - same);
            // and each worker's clock counts its own steps
            expect(Math.max(...events.map((e) => e.clock)), at).toBe(Math.max(...per));
          }
        }
      }
    }
  });

  it('drives the readouts', async () => {
    for (const share of [60, 100]) {
      const ints = await read(ID, claim('Clock integers carried', { [KEY]: share }, { against: 'Messages', tolerance: 0 }));
      expect(ints.reason).toBeUndefined();
      expect(ints.value, `share ${share}`).toBe(0);
      expect((await read(ID, claim('Causal pairs out of order', { [KEY]: share }))).value, `share ${share}`).toBe(0);
    }
    expect((await read(ID, claim('Messages', { [KEY]: 100 }))).value).toBe(0);
    const conc = await read(ID, claim('Concurrent pairs given an order', { [KEY]: 100 }));
    const { events } = simulate(k, defaultParams(k, { [KEY]: 100 }), DEFAULT_SEED).result;
    const same = [0, 1, 2, 3].reduce((s, i) => s + pairs(events.filter((e) => e.proc === i).length), 0);
    expect(conc.value).toBe(pairs(events.length) - same);
  });
});

describe('the logical clocks at their defaults are what they were before the control', () => {
  // recorded on the code before the control existed (main 23b65ad), over the trace's integers
  // and strings only, for both kernels on the shared workload
  const TRACE = '1c75c443dcb0a3b7';

  it('record the same trace for every seed and number of workers', () => {
    const all = [k, vector as SystemsKernel].flatMap((kk) => [2, 4, 6].flatMap((procs) =>
      [1, 2, 3, 4242].map((seed) => hash(simulate(kk, defaultParams(kk, { procs }), seed).net.events.map(shape)))));
    expect(hash(all)).toBe(TRACE);
  });
});
