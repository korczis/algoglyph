// The settle signal of the bespoke esoteric sorting plates (src/plates/_shared/settle/): each of
// them starts a new run after one ends, so the claims instrument (ADR 0007) could never see one
// settle. The `runs` control stops a plate after k completed runs; `completed runs` counts the
// runs that have ended, once each, and `last completed run` holds what the last one measured.
// Every plate is checked against its own kernel mirror replayed independently: the plate stops
// on the k-th run, and the run its counter names is the run its readout describes.
import { describe, expect, it } from 'vitest';
import { calm } from '../src/core/pace';
import type { Params, PlateCode } from '../src/core/plate';
import {
  COMPLETED_RUNS, LAST_COMPLETED_RUN, RUNS_KEY, RunCounter, runsParam,
} from '../src/plates/_shared/settle/settle';
import { input, runSeed } from '../src/plates/_shared/sort-input/input';
import bogobogosort from '../src/plates/bogobogosort/plate';
import { bbsRun } from '../src/plates/bogobogosort/bogobogosort';
import bogosort from '../src/plates/bogosort/plate';
import { bogoRun } from '../src/plates/bogosort/bogosort';
import bozosort from '../src/plates/bozosort/plate';
import { bozoRun } from '../src/plates/bozosort/bozosort';
import burntPancakeSort from '../src/plates/burnt-pancake-sort/plate';
import { pancakeRun } from '../src/plates/burnt-pancake-sort/pancake';
import slowsort from '../src/plates/slowsort/plate';
import { slowRun } from '../src/plates/slowsort/slowsort';
import stalinSort from '../src/plates/stalin-sort/plate';
import { stalinRun } from '../src/plates/stalin-sort/stalin';
import stoogeSort from '../src/plates/stooge-sort/plate';
import { stoogeRun } from '../src/plates/stooge-sort/stooge';
import worstsort from '../src/plates/worstsort/plate';
import { worstRun } from '../src/plates/worstsort/worstsort';
import { nthNumber } from './support/claims';
import { headless } from './support/esoteric';

/** The pace control's top: the most kernel steps a frame, as the claims instrument runs. */
const TOP = 16384 / calm('stream');
const SEED = 4242;

/** Every number of a readout as displayed, in order. */
function numbers(text: string | undefined): number[] {
  const out: number[] = [];
  for (let i = 1; ; i++) {
    const x = nthNumber(text ?? '', i);
    if (x === null) return out;
    out.push(x);
  }
}

interface Subject {
  plate: PlateCode;
  params: Params;
  /** The leading numbers `last completed run` shows for run r (from 0), replayed independently. */
  replay(r: number): number[];
}

const seedOf = (r: number) => runSeed(SEED, r);

const SUBJECTS: Subject[] = [
  {
    plate: bogosort, params: { n: 5, shape: 'random' },
    replay(r) {
      const x = bogoRun(input('random', 5, seedOf(r)), seedOf(r));
      x.stepper.finish();
      return [x.state.shuffles, x.stepper.t.counts.cmp, x.stepper.t.counts.swap];
    },
  },
  {
    plate: bozosort, params: { n: 5, shape: 'random', rule: 'any' },
    replay(r) {
      const x = bozoRun(input('random', 5, seedOf(r)), seedOf(r), 'any');
      x.stepper.finish();
      return [x.state.swaps, x.stepper.t.counts.cmp, x.stepper.t.counts.swap];
    },
  },
  {
    plate: bogobogosort, params: { n: 4, shape: 'random' },
    replay(r) {
      const x = bbsRun(input('random', 4, seedOf(r)), seedOf(r));
      x.stepper.finish();
      return [x.state.shuffles, x.stepper.t.counts.cmp, x.stepper.t.counts.swap];
    },
  },
  {
    plate: slowsort, params: { n: 9, shape: 'random' },
    replay(r) {
      const x = slowRun(input('random', 9, seedOf(r)), seedOf(r));
      x.stepper.finish();
      return [x.stepper.t.counts.cmp, x.stepper.t.counts.swap];
    },
  },
  {
    plate: stoogeSort, params: { n: 11, shape: 'random' },
    replay(r) {
      const x = stoogeRun(input('random', 11, seedOf(r)), seedOf(r));
      x.stepper.finish();
      return [x.stepper.t.counts.cmp, x.stepper.t.counts.swap];
    },
  },
  {
    plate: worstsort, params: { n: 4, shape: 'random', levels: '1' },
    replay(r) {
      const x = worstRun(input('random', 4, seedOf(r)));
      x.stepper.finish();
      return [x.state.lex, x.state.swaps];
    },
  },
  {
    plate: stalinSort, params: { n: 64, shape: 'random' },
    replay(r) {
      const x = stalinRun(input('random', 64, seedOf(r)), seedOf(r));
      x.stepper.finish();
      return [x.state.kept, x.stepper.t.counts.cmp];
    },
  },
  {
    plate: burntPancakeSort, params: { n: 12, shape: 'random', orient: 'random' },
    replay(r) {
      const x = pancakeRun(input('random', 12, seedOf(r)), seedOf(r), 'random');
      x.stepper.finish();
      return [x.state.flips];
    },
  },
];

/** Frames enough for any of these plates to finish a run and sit out its hold. */
const PER_RUN = 400;

describe('the run counter', () => {
  it('counts each completed run once and stops at the limit the runs control sets', () => {
    const params: Params = { [RUNS_KEY]: 0 };
    const c = new RunCounter(params);
    expect(c.count).toBe(0);
    expect(c.stopped).toBe(false);
    const rows = () => Object.fromEntries(c.rows().map((r) => [r.label, r.value]));
    expect(rows()).toEqual({ [COMPLETED_RUNS]: '0', [LAST_COMPLETED_RUN]: '–' });
    c.complete('7 shuffles');
    c.complete('9 shuffles');
    expect(c.count).toBe(2);
    expect(c.stopped).toBe(false);
    expect(rows()[LAST_COMPLETED_RUN]).toBe('9 shuffles');
    // a limit read live: reached, the plate stops; raised, it runs on
    params[RUNS_KEY] = 2;
    expect(c.stopped).toBe(true);
    expect(rows()[COMPLETED_RUNS]).toBe('2 of 2, stopped');
    params[RUNS_KEY] = 3;
    expect(c.stopped).toBe(false);
    expect(rows()[COMPLETED_RUNS]).toBe('2 of 3');
    c.complete('1 shuffles');
    expect(c.stopped).toBe(true);
    expect(c.count).toBe(3);
  });

  it('is a range from 0 (never stop, the default) and the same control on every plate', () => {
    const d = runsParam();
    expect(d).toMatchObject({ kind: 'range', key: RUNS_KEY, min: 0, value: 0, step: 1 });
    for (const s of SUBJECTS) {
      expect(s.plate.params.find((x) => x.key === RUNS_KEY), s.plate.id).toEqual(d);
    }
  });
});

for (const s of SUBJECTS) {
  describe(`${s.plate.id}: the settle signal`, () => {
    it('stops on the k-th completed run and holds it', () => {
      for (const k of [1, 2, 3]) {
        const h = headless(s.plate, { ...s.params, pace: TOP, [RUNS_KEY]: k });
        h.frames(k * PER_RUN);
        const st = h.stats();
        expect(numbers(st[COMPLETED_RUNS])[0], `${s.plate.id} runs ${k}`).toBe(k);
        expect(numbers(st[LAST_COMPLETED_RUN]).slice(0, s.replay(k - 1).length), `${s.plate.id} run ${k}`)
          .toEqual(s.replay(k - 1));
      }
    });

    it('counts every finished run once while it runs on, never going back', () => {
      const h = headless(s.plate, { ...s.params, pace: TOP });
      let last = 0;
      for (let f = 0; f < 4 * PER_RUN; f++) {
        h.frames(1);
        const c = numbers(h.stats()[COMPLETED_RUNS])[0];
        expect(c, `${s.plate.id} frame ${f}`).toBeGreaterThanOrEqual(last);
        last = c;
      }
      expect(last, s.plate.id).toBeGreaterThanOrEqual(3);
      // the counter names the run the readout describes: a run counted twice, or missed, would
      // point at a different input
      const r = numbers(h.stats()[LAST_COMPLETED_RUN]);
      expect(r.slice(0, s.replay(last - 1).length)).toEqual(s.replay(last - 1));
    });

    it('reads the same still readouts after k runs, for the seed', () => {
      const a = headless(s.plate, { ...s.params, pace: TOP, [RUNS_KEY]: 2 });
      const b = headless(s.plate, { ...s.params, pace: TOP, [RUNS_KEY]: 2 });
      a.frames(2 * PER_RUN);
      b.frames(2 * PER_RUN);
      const settled = a.stats();
      expect(b.stats()).toEqual(settled);
      a.frames(PER_RUN);
      expect(a.stats()).toEqual(settled);
    });

    it('runs on when the limit is raised past the runs completed', () => {
      const params = { ...s.params, pace: TOP, [RUNS_KEY]: 1 };
      const h = headless(s.plate, params);
      h.frames(PER_RUN);
      expect(numbers(h.stats()[COMPLETED_RUNS])[0]).toBe(1);
      // the live params object the plate reads: raise the limit as the control would
      h.params[RUNS_KEY] = 2;
      h.frames(PER_RUN);
      expect(numbers(h.stats()[COMPLETED_RUNS])[0]).toBe(2);
      expect(numbers(h.stats()[LAST_COMPLETED_RUN]).slice(0, s.replay(1).length)).toEqual(s.replay(1));
    });
  });
}
