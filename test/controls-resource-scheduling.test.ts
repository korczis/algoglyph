// resource-scheduling's two fixed constants become controls (S3 C1, C2): the largest task demand
// (demand = 1 + ⌊u · min(maxDemand, units)⌋, the old constant 3) and the dependency chance (each
// of the six tasks before a task is a predecessor with probability density / 100, the old 0.28).
// Checked: each control exists with the old constant as its default, it travels in a shared link,
// it drives what the plate reads (the two lower bounds always, Graham's bound at unit demands,
// the critical path as one duration without dependencies), and the default run is what it was.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/systems';
import { defaultParams, simulate, type SystemsKernel } from '../src/engines/systems/sim';
import { kernel as raw, type ScheduleResult } from '../src/kernels/systems/resource-scheduling';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const kernel = raw as SystemsKernel<ScheduleResult>;
const ID = 'resource-scheduling';
const entry = ENTRIES.find((e) => e.id === ID)!;
const plate = () => engine.plate({ id: entry.id, title: entry.title, group: entry.taxonomy }, kernel);
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 4242];
const SHAPES: [number, number][] = [[18, 4], [30, 2], [8, 8], [25, 5], [4, 2], [30, 8]];

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);
const defOf = (key: string) => kernel.params?.find((d) => d.key === key) as RangeParam | undefined;
const sim = (p: Params, seed: number) => simulate(kernel, p, seed).result;
const end = (r: ScheduleResult) => Math.max(...r.tasks.map((t) => t.finish));

const claim = (readout: string, params: Params, expect: Claim['expect'] = { range: [-1e12, 1e12] }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });

/** The hard bounds of any schedule: the longest chain and the work spread over every unit. */
function bounds(r: ScheduleResult, units: number) {
  const e = end(r);
  expect(e).toBeGreaterThanOrEqual(r.critical);
  expect(e * units).toBeGreaterThanOrEqual(r.work);
  expect((100 * r.work) / (units * e)).toBeLessThanOrEqual(100);
}

function roundTrip(key: string, values: number[]) {
  const defs = plate().params;
  const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
  for (const v of values) {
    expect(parse(defs, serialise(defs, { ...d, [key]: v }, 7)), `${key} ${v}`).toEqual({ seed: 7, params: { [key]: v } });
  }
}

describe('resource-scheduling: largest task demand', () => {
  const KEY = 'maxDemand';

  it('is a range control with the old constant as its default', () => {
    expect(defOf(KEY)).toMatchObject({ kind: 'range', label: 'Largest task demand (units)', min: 1, max: 8, step: 1, value: 3, rebuild: true });
    expect(plate().params.find((x) => x.key === KEY)).toEqual(defOf(KEY));
  });

  it('round-trips through a shared link', () => roundTrip(KEY, [1, 5, 8]));

  it('sets every demand to 1..min(maxDemand, units), and the bounds hold, at every setting', () => {
    for (const k of settings(defOf(KEY)!)) {
      for (const [tasks, units] of SHAPES) {
        for (const seed of SEEDS) {
          const r = sim(defaultParams(kernel, { tasks, units, [KEY]: k }), seed);
          for (const t of r.tasks) {
            expect(t.demand).toBeGreaterThanOrEqual(1);
            expect(t.demand, `k=${k} units=${units}`).toBeLessThanOrEqual(Math.min(k, units));
          }
          bounds(r, units);
          if (k === 1) {
            // unit demands on m identical units, never idle while a task is ready: Graham (1966),
            // makespan ≤ work / m + (1 − 1/m) · critical path
            expect(r.tasks.every((t) => t.demand === 1)).toBe(true);
            expect(end(r) * units, `Graham tasks=${tasks} units=${units} seed=${seed}`)
              .toBeLessThanOrEqual(r.work + (units - 1) * r.critical);
          }
        }
      }
    }
    // the control reaches past the old constant: at 8 on 8 units some task needs more than 3
    const wide = SEEDS.flatMap((seed) => sim(defaultParams(kernel, { tasks: 30, units: 8, [KEY]: 8 }), seed).tasks);
    expect(Math.max(...wide.map((t) => t.demand))).toBeGreaterThan(3);
  });

  it('drives the readouts: unit demands and no more tasks than units, the makespan is the critical path', async () => {
    // at most 8 tasks on 8 units, each needing one: a ready task always finds a free unit
    const r = await read(ID, claim('Makespan', { [KEY]: 1, units: 8, tasks: 8 },
      { against: 'Critical path (lower bound)', tolerance: 0 }));
    expect(r.reason).toBeUndefined();
    expect(r.value).toBe(0);
    const u = await read(ID, claim('Utilisation', { [KEY]: 8, units: 8, tasks: 30 }));
    expect(u.reason).toBeUndefined();
    expect(u.value!).toBeLessThanOrEqual(100);
    const lb = await read(ID, claim('Makespan', { [KEY]: 8, units: 8, tasks: 30 }, { against: 'Result', against_number: 3, above: -1 }));
    expect(lb.reason).toBeUndefined();
    expect(lb.value!).toBeGreaterThan(-1);
  });
});

describe('resource-scheduling: dependency chance', () => {
  const KEY = 'density';

  it('is a range control with the old constant as its default', () => {
    expect(defOf(KEY)).toMatchObject({ kind: 'range', label: 'Dependency chance (%)', min: 0, max: 60, step: 4, value: 28, rebuild: true });
    expect(plate().params.find((x) => x.key === KEY)).toEqual(defOf(KEY));
  });

  it('round-trips through a shared link', () => roundTrip(KEY, [0, 12, 60]));

  it('sets the dependencies, and the bounds hold, at every setting', () => {
    let fewer = 0; let more = 0;
    for (const c of settings(defOf(KEY)!)) {
      for (const [tasks, units] of SHAPES) {
        for (const seed of SEEDS) {
          const r = sim(defaultParams(kernel, { tasks, units, [KEY]: c }), seed);
          bounds(r, units);
          for (const t of r.tasks) for (const q of t.preds) expect(t.id - q).toBeGreaterThanOrEqual(1);
          for (const t of r.tasks) for (const q of t.preds) expect(t.id - q).toBeLessThanOrEqual(6);
          const edges = r.tasks.reduce((s, t) => s + t.preds.length, 0);
          if (c === 0) {
            // no dependencies: every task is a chain of its own, so the critical path is the
            // longest single duration, exactly
            expect(edges).toBe(0);
            expect(r.critical).toBe(Math.max(...r.tasks.map((t) => t.dur)));
          }
          if (c === 60) more += edges;
          if (c === 4) fewer += edges;
        }
      }
    }
    expect(more).toBeGreaterThan(fewer);
  });

  it('drives the readouts: independent tasks, one unit each, all at once', async () => {
    // no dependencies and every task alone on a unit: all start at 0, the makespan is the
    // longest duration, which is the critical path, 100 + 50 k for k in 0..8
    const p = { [KEY]: 0, maxDemand: 1, units: 8, tasks: 8 };
    const r = await read(ID, claim('Makespan', p, { against: 'Critical path (lower bound)', tolerance: 0 }));
    expect(r.reason).toBeUndefined();
    expect(r.value).toBe(0);
    const c = await read(ID, claim('Critical path (lower bound)', p));
    expect(c.reason).toBeUndefined();
    expect(c.value!).toBeGreaterThanOrEqual(100);
    expect(c.value!).toBeLessThanOrEqual(500);
    const lb = await read(ID, claim('Makespan', { [KEY]: 60, tasks: 30 }, { against: 'Result', against_number: 3, above: -1 }));
    expect(lb.reason).toBeUndefined();
    expect(lb.value!).toBeGreaterThan(-1);
  });
});

describe('resource-scheduling at its defaults is what it was before the controls', () => {
  // integers only (task graph, demands, start and finish times), recorded on the code before the
  // controls existed (main 23b65ad)
  const RUNS = '2ecc395302575c4a';
  const record = (over: Params) => SHAPES.flatMap(([tasks, units]) => SEEDS.map((seed) => {
    const r = sim({ tasks, units, ...over }, seed);
    return [tasks, units, seed, r.critical, r.work, r.decisions.length,
      r.tasks.map((t) => [t.preds, t.dur, t.demand, t.prio, t.start, t.finish, t.units, t.ready])];
  }));

  it('draws the same tasks and schedules them the same', () => {
    expect(hash(record({}))).toBe(RUNS);
  });

  it('the explicit defaults run as no param does', () => {
    expect(record({ maxDemand: 3, density: 28 })).toEqual(record({}));
  });
});
