// The pacing contract (config/pacing.yaml, ADR 0008, rule project.viz-component-layer), counted
// in frames and never timed: the file is sound, the derivation keeps its promises, every live
// plate and runnable lab declares its pace, and at its defaults (seed 4242, loop off) a paced run
// lasts within its kind's window and shows no more changes a second than its ceiling. Driving
// every run to its end is `npm run test:pacing` (test/pacing/, one process per wing).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the Vite plugin
import { checkPacing, loadPacing } from '../scripts/lib/pacing.mjs';
import { calm, calmSeconds, downFrom, fitSize, FPS, HOLD_FRAMES, PACING, Pacer, paceParam, type PaceReport } from '../src/core/pace';
import type { PlateCode } from '../src/core/plate';
import { snap } from '../src/core/share';
import { arithmeticErrors, declarationErrors, drivenErrors, known, mount, subjectsOf } from './support/pacing';

const replay = PACING.kinds.replay;
const views = PACING.kinds.views;

describe('config/pacing.yaml', () => {
  it('is sound, and the site reads exactly what the file says', () => {
    const { errors, model } = loadPacing();
    expect(errors).toEqual([]);
    expect(PACING).toEqual(model);
    expect(HOLD_FRAMES).toBe(Math.round(PACING.hold_s * PACING.fps));
  });

  it('refuses a target outside its window, a floor above its ceiling and a missing kind', () => {
    const { model } = loadPacing();
    const bad = structuredClone(model);
    bad.kinds.replay.target_s = 90;
    bad.kinds.views.min_per_s = 50;
    delete bad.kinds.stream;
    bad.kinds.burst = { max_per_s: 1 };
    const errors: string[] = checkPacing(bad);
    expect(errors.some((e) => e.includes('kinds.replay.target_s'))).toBe(true);
    expect(errors.some((e) => e.includes('kinds.views.min_per_s'))).toBe(true);
    expect(errors.some((e) => e.includes('kinds.stream is missing'))).toBe(true);
    expect(errors.some((e) => e.includes('kinds.burst is not one of'))).toBe(true);
  });

  it('refuses a pace control that cannot hold the calm rate', () => {
    const { model } = loadPacing();
    const bad = structuredClone(model);
    bad.pace.min = 2;
    expect(checkPacing(bad).some((e: string) => e.includes('must contain 1'))).toBe(true);
  });
});

describe('the derivation (src/core/pace.ts)', () => {
  it('paces a run to its target, within the ceiling and the floor', () => {
    // half the ceiling for the whole target: the run is paced to last exactly the target
    const atTarget = (replay.max_per_s / 2) * replay.target_s;
    expect(calmSeconds('replay', atTarget)).toBeCloseTo(replay.target_s, 9);
    // a run too long for the target is held at the ceiling, and lasts longer
    expect(calm('replay', 1e6) * FPS).toBeCloseTo(replay.max_per_s, 9);
    // a very short run still moves at the floor
    expect(calm('replay', 2) * FPS).toBeCloseTo(replay.min_per_s, 9);
    // an unknown length, and every stream, run at the ceiling
    expect(calm('views', null) * FPS).toBeCloseTo(views.max_per_s, 9);
    expect(calm('stream') * FPS).toBeCloseTo(PACING.kinds.stream.max_per_s, 9);
  });

  it('applies whole changes, carrying the fraction: 0.25 per frame is one change every 4 frames', () => {
    const pacer = new Pacer('replay', 'events', 2000);
    pacer.start(300); // 300 / (20 s × 60) = 0.25 per frame
    const takes = Array.from({ length: 16 }, () => pacer.take({ pace: 1 }));
    expect(takes).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    // over any number of frames, the sum is the rate times the frames, never more
    const many = new Pacer('replay', 'events', 2000);
    many.start(4321);
    let sum = 0;
    for (let f = 1; f <= 1000; f++) {
      sum += many.take({ pace: 1 });
      expect(sum).toBe(Math.floor(f * calm('replay', 4321) + 1e-9));
    }
  });

  it('multiplies by the pace control, and never asks more than the engine allows per frame', () => {
    const pacer = new Pacer('replay', 'events', 40);
    pacer.start(600);
    expect(pacer.perFrame({ pace: 4 })).toBeCloseTo(4 * calm('replay', 600), 12);
    expect(pacer.perFrame({ pace: PACING.pace.max })).toBe(40);
  });

  it('lets a run whose length is learnt late end when a calm run of that length would', () => {
    const pacer = new Pacer('views', 'views', 8);
    pacer.start();
    let at = 0;
    for (let f = 0; f < 30; f++) at += pacer.take({ pace: 1 }); // at the ceiling while recording
    pacer.known(100, at);
    let frames = 30;
    while (at < 100) { at += pacer.take({ pace: 1 }); frames++; }
    expect(Math.abs(frames - calmSeconds('views', 100) * FPS)).toBeLessThanOrEqual(2);
  });

  it('fits an input to the window: the default when it fits, else the largest that does', () => {
    // n² changes at the ceiling fit fit_s up to n² = max_per_s × fit_s
    const quadratic = (n: number) => n * n;
    const largest = Math.floor(Math.sqrt(replay.max_per_s * (replay.fit_s ?? replay.run_s[1])) / 8) * 8;
    expect(fitSize('replay', downFrom(64, 8, 8), quadratic)).toBe(largest);
    expect(fitSize('replay', downFrom(16, 8, 8), quadratic)).toBe(16);
  });

  it('puts the pace control on a log slider whose grid holds the calm rate', () => {
    const d = paceParam();
    expect(d.log).toBe(true);
    expect(d.value).toBe(1);
    expect(snap(d, 1)).toBe(1);
  });
});

// a plate built to break each rule, the way a careless one would
const fixture = (over: Partial<PlateCode>): PlateCode => ({
  id: 'fixture', mode: '2d', aspect: 1, params: [], create: () => ({ setup() {}, draw() {} }), ...over,
});
function fasterErrors(label: string, before: { unit: string; per_s: number }, r: PaceReport): string[] {
  const now = r.perFrame * FPS;
  return now > before.per_s + 1e-9
    ? [`${label}: ${now.toFixed(1)} ${r.unit}/s at its defaults, faster than the ${before.per_s}/s it showed at 4fe8360`] : [];
}

const report = (over: Partial<PaceReport>): PaceReport => ({
  kind: 'replay', unit: 'events', perFrame: 0.5, length: 600, seconds: 20, done: false, ...over,
});

describe('the contract refuses', () => {
  it('a plate that declares no pace', () => {
    expect(declarationErrors(fixture({}))).toEqual(['fixture declares no pace (PlateCode.pace, src/core/pace.ts)']);
  });

  it('a rate control of its own on a paced plate, and a paced plate without the pace control', () => {
    const errors = declarationErrors(fixture({
      pace: { kind: 'replay', unit: 'operations' },
      params: [{ kind: 'range', key: 'speed', label: 'Operations per frame', min: 1, max: 2000, step: 1, value: 6 }],
    }));
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('"Operations per frame" sets a rate of its own');
  });

  it('an emergent stream or a still plate that does not say why', () => {
    expect(declarationErrors(fixture({ pace: { kind: 'stream', emergent: ' ' } }))[0]).toContain('reason is empty');
    expect(declarationErrors(fixture({ pace: { kind: 'still', why: '' } }))[0]).toContain('reason is empty');
  });

  it('a default run that shows more than its ceiling, or ends too soon or too late', () => {
    const decl = { kind: 'replay', unit: 'events' } as const;
    // the old defaults: six operations a frame, a run over in eight seconds
    const fast = arithmeticErrors('fast', report({ perFrame: 6, length: 2934, seconds: 2934 / 6 / FPS }), decl);
    expect(fast.some((e) => e.includes('360.0 events/s at its defaults, above the 30/s'))).toBe(true);
    expect(fast.some((e) => e.includes('shorter than 10 s'))).toBe(true);
    expect(arithmeticErrors('slow', report({ length: 9941, seconds: 9941 / 0.5 / FPS }), decl)[0]).toContain('longer than 60 s');
    expect(arithmeticErrors('unknown', report({ length: null, seconds: null }), decl)[0]).toContain('still unknown');
    expect(arithmeticErrors('none', undefined, decl)[0]).toContain('reports none');
  });

  it('a run short by content is not refused: its every change holds the floor', () => {
    const decl = { kind: 'replay', unit: 'rounds' } as const;
    expect(arithmeticErrors('short', report({ perFrame: 1 / 60, length: 5, seconds: 5 }), decl)).toEqual([]);
  });

  it('a stream that declares a rate above the ceiling, or none at all, or runs above its own', () => {
    const pace = [{ kind: 'range', key: 'pace', label: 'Pace (× calm)', min: 0.125, max: 4096, step: 0.125, value: 1 }] as PlateCode['params'];
    expect(declarationErrors(fixture({ params: pace, pace: { kind: 'stream', unit: 'ticks', per_s: 45 } }))[0]).toContain('the ceiling is a maximum');
    expect(declarationErrors(fixture({ params: pace, pace: { kind: 'stream', unit: 'ticks', per_s: 0 } }))[0]).toContain('must lie in');
    expect(declarationErrors(fixture({ params: pace, pace: { kind: 'stream', unit: 'ticks', per_s: 15 } }))).toEqual([]);
    const decl = { kind: 'stream', unit: 'ticks', per_s: 15 } as const;
    expect(arithmeticErrors('queue', report({ kind: 'stream', unit: 'ticks', perFrame: 0.5, length: null, seconds: null }), decl)[0])
      .toContain('above the 15/s it declares');
  });

  it('a stream over the ceiling', () => {
    const decl = { kind: 'stream', unit: 'generations' } as const;
    expect(arithmeticErrors('life', report({ kind: 'stream', unit: 'generations', perFrame: 2, length: null, seconds: null }), decl)[0])
      .toContain('120.0 generations/s');
  });

  it('a driven run that ends outside the window, or never', () => {
    expect(drivenErrors('quick', 480, report({}))[0]).toContain('shorter than 10 s');
    expect(drivenErrors('long', 60 * 61, report({}))[0]).toContain('longer than 60 s');
    expect(drivenErrors('hung', Infinity, report({}))[0]).toContain('did not end');
    expect(drivenErrors('calm', 1200, report({}))).toEqual([]);
  });
});

// What every subject showed at its defaults before ADR 0008, measured once and pinned to its
// commit: the owner's complaint was "too fast", so no plate may show more changes a second now.
// A subject whose counted unit changed (rounds, notes, key operations, lane changes) is listed
// apart and not compared by number; a subject added since has no earlier rate to keep.
const BEFORE = JSON.parse(readFileSync('test/fixtures/pacing/before.json', 'utf8')) as {
  measured_at: string; same_unit: Record<string, { unit: string; per_s: number }>;
  other_unit: Record<string, { unit: string; per_s: number | null }>;
};

describe('no default is faster than before', () => {
  it('refuses a rate above the one it replaced', () => {
    expect(fasterErrors('queue', { unit: 'ticks', per_s: 15 }, report({ kind: 'stream', unit: 'ticks', perFrame: 0.5 })))
      .toEqual(['queue: 30.0 ticks/s at its defaults, faster than the 15/s it showed at 4fe8360']);
    expect(fasterErrors('queue', { unit: 'ticks', per_s: 15 }, report({ kind: 'stream', unit: 'ticks', perFrame: 0.25 }))).toEqual([]);
  });

  for (const s of subjectsOf({ all: true }).filter((x) => x.label in BEFORE.same_unit)) {
    it(`${s.label} shows no more changes a second than it did`, async () => {
      const plate = (await s.load())!;
      const { sim } = mount(plate);
      const { report: r } = known(sim);
      if (!r) return; // an emergent or still plate keeps its own controls
      expect(r.unit, `${s.label}: the unit it counts`).toBe(BEFORE.same_unit[s.label].unit);
      expect(fasterErrors(s.label, BEFORE.same_unit[s.label], r)).toEqual([]);
    });
  }
});

describe('every live plate and runnable lab, at its defaults', () => {
  for (const s of subjectsOf({ all: true })) {
    it(`${s.label} declares its pace and keeps it`, async () => {
      const plate = (await s.load())!;
      expect(declarationErrors(plate)).toEqual([]);
      const { sim } = mount(plate);
      expect(arithmeticErrors(s.label, known(sim).report, plate.pace)).toEqual([]);
    });
  }
});
