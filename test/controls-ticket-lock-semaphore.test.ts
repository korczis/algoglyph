// The ticket lock's spin poll interval becomes a control (S3 B3): a waiting worker re-read the
// serving counter every fixed 6 ms (plus the 1.5 ms memory access); now every `poll` ms, whose
// default 6 is the old constant. Checked: the control exists with its range, it travels in a
// shared link, it drives the run (every lock wait is a whole number of polls, the grants stay
// in ticket order and the slots within the count at every setting), and the default run is the
// run recorded before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { defaultParams, simulate, total, type SystemsKernel } from '../src/engines/systems/sim';
import { kernel, maxOverlap, type LockResult } from '../src/kernels/systems/ticket-lock-semaphore';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'ticket-lock-semaphore';
const KEY = 'poll';
/** One access to the shared counters (the kernel's MEMORY): a poll costs poll + 1.5 ms. */
const MEMORY = 1.5;
const k = kernel as SystemsKernel<LockResult>;
/** The default shape, the most contended one and the least. */
const SHAPES: Params[] = [{}, { workers: 8, slots: 1 }, { workers: 2, slots: 4 }];
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { above: -1 }, setup: { params: params as Record<string, number> } });

describe('ticket-lock-semaphore: spin poll interval', () => {
  it('is a range control, the old constant its default', async () => {
    const want = { kind: 'range', key: KEY, label: 'Spin poll interval (ms)', min: 6, max: 30, step: 1, value: 6, rebuild: true };
    expect(k.params?.find((d) => d.key === KEY)).toEqual(want);
    const plate = await loadPlate(ID)!;
    expect(plate.params.find((d) => d.key === KEY)).toEqual(want);
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID)!).params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [7, 18, 30]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('makes every lock wait a whole number of polls, in ticket order, within the slots', () => {
    const d = k.params!.find((x) => x.key === KEY) as RangeParam;
    for (let poll = d.min; poll <= d.max; poll += d.step) {
      for (const over of SHAPES) {
        for (const seed of [1, 4242]) {
          const { net, result } = simulate(k, defaultParams(k, { ...over, [KEY]: poll }), seed);
          const at = `poll ${poll} ${JSON.stringify(over)} seed ${seed}`;
          // the worker checks the serving counter on taking its ticket, then every poll + 1.5 ms
          let polls = 0;
          for (const h of result.lock.filter((x) => !Number.isNaN(x.granted))) {
            const j = (h.granted - h.asked) / (poll + MEMORY);
            expect(Math.abs(j - Math.round(j)), at).toBeLessThan(1e-6);
            polls += Math.round(j);
          }
          // every poll that does not grant is a spin; a ticket still waiting at the end spun too
          expect(total(net, 'spins'), at).toBeGreaterThanOrEqual(polls);
          expect(total(net, 'lock.out_of_order'), at).toBe(0);
          expect(maxOverlap(result.slots), at).toBeLessThanOrEqual(result.k);
        }
      }
    }
  });

  it('drives the readouts: fewer polls, the order and the slots kept', async () => {
    const spins: number[] = [];
    for (const poll of [6, 15, 30]) {
      const s = await read(ID, claim('Polls while spinning', { [KEY]: poll }));
      expect(s.reason).toBeUndefined();
      spins.push(s.value!);
      expect((await read(ID, claim('Lock grants out of ticket order', { [KEY]: poll }))).value, `poll ${poll}`).toBe(0);
      expect((await read(ID, claim('Most slots held at once', { [KEY]: poll }))).value!, `poll ${poll}`).toBeLessThanOrEqual(2);
    }
    // a longer interval polls less often
    expect(spins[1]).toBeLessThan(spins[0]);
    expect(spins[2]).toBeLessThan(spins[1]);
  });
});

describe('ticket-lock-semaphore at its defaults is what it was before the control', () => {
  // recorded on the code before the control existed (main 23b65ad); the run draws only uniform
  // numbers (no sin, cos, log or exp), so its trace is the same on every platform
  const TRACE = '3ec1b9d9cacb2d2d';

  it('records the same trace for every seed and shape', () => {
    const all = SHAPES.flatMap((over) =>
      [1, 2, 3, 4242].map((seed) => hash(simulate(k, defaultParams(k, over), seed).net.events)));
    expect(hash(all)).toBe(TRACE);
  });
});
