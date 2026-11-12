// The share of local steps becomes a control on the vector clocks too (S3 B4), from the one
// factory of the shared workload (src/kernels/systems/_history.ts): see
// test/controls-lamport-clocks.test.ts, which also pins both kernels' default traces. Checked
// here: the control exists with its range, it travels in a shared link, and it drives what the
// plate reads (n integers per message, the vectors' concurrency equal to happened-before's, and
// at 100% no message, so the ordered pairs are exactly those on one worker).
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED } from '../src/core/claims';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { defaultParams, simulate, total, type SystemsKernel } from '../src/engines/systems/sim';
import { happenedBefore } from '../src/kernels/systems/_history';
import { compare, kernel, type VectorResult } from '../src/kernels/systems/vector-clocks';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'vector-clocks';
const KEY = 'localShare';
const k = kernel as SystemsKernel<VectorResult>;
const claim = (readout: string, params: Params, expect: Claim['expect'] = { above: -1 }): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });
const pairs = (m: number) => (m * (m - 1)) / 2;

describe('vector-clocks: local steps', () => {
  it('is a range control, the old constant its default', async () => {
    const want = { kind: 'range', key: KEY, label: 'Local steps (%)', min: 30, max: 100, step: 10, value: 30, rebuild: true };
    expect(k.params?.find((d) => d.key === KEY)).toEqual(want);
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

  it('carries n integers per message and detects exactly the concurrent pairs, at every setting', () => {
    const d = k.params!.find((x) => x.key === KEY) as RangeParam;
    for (let share = d.min; share <= d.max; share += d.step) {
      for (const procs of [2, 4, 6]) {
        for (const seed of [1, 4242]) {
          const { net, result: { events } } = simulate(k, defaultParams(k, { procs, [KEY]: share }), seed);
          const at = `share ${share} procs ${procs} seed ${seed}`;
          const sends = total(net, 'events.send');
          expect(total(net, 'clock.ints'), at).toBe(procs * sends);
          const hb = happenedBefore(events);
          let conc = 0; let causal = 0;
          for (let b = 0; b < events.length; b++) {
            for (let a = 0; a < b; a++) {
              const rel = compare(events[a].clock, events[b].clock);
              if (hb[b][a]) { expect(rel, at).toBe('before'); causal++; } else { expect(rel, at).toBe('concurrent'); conc++; }
            }
          }
          expect(total(net, 'pairs.concurrent'), at).toBe(conc);
          expect(total(net, 'pairs.ordered'), at).toBe(causal);
          if (share === 100) {
            expect(sends, at).toBe(0);
            const same = Array.from({ length: procs }, (_, i) => pairs(events.filter((e) => e.proc === i).length)).reduce((s, x) => s + x, 0);
            expect(causal, at).toBe(same);
            expect(conc, at).toBe(pairs(events.length) - same);
          }
        }
      }
    }
  });

  it('drives the readouts', async () => {
    for (const share of [60, 100]) {
      const live = await read(ID, claim('Pairs detected concurrent', { [KEY]: share }, { against: 'Result', tolerance: 0 }));
      expect(live.reason).toBeUndefined();
      expect(live.value, `share ${share}`).toBe(0);
    }
    expect((await read(ID, claim('Clock integers carried', { [KEY]: 100 }))).value).toBe(0);
    const { events } = simulate(k, defaultParams(k, { [KEY]: 100 }), DEFAULT_SEED).result;
    const same = [0, 1, 2, 3].reduce((s, i) => s + pairs(events.filter((e) => e.proc === i).length), 0);
    expect((await read(ID, claim('Pairs detected concurrent', { [KEY]: 100 }))).value).toBe(pairs(events.length) - same);
    expect((await read(ID, claim('Pairs ordered by causality', { [KEY]: 100 }))).value).toBe(same);
  });
});
