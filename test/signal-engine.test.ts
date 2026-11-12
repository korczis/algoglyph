// The signal engine records a kernel's run off the frame path (rule project.viz-component-layer):
// create() does none of the run, a slider drag (parameters changing every frame without a
// remount, as Alpine's x-model does on every input event) starts no re-record until the controls
// settle and costs a bounded frame, and the last finished run stays on screen until the run for
// the new settings is complete.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ENTRIES } from '../src/core/catalogue';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import type { Params, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { engine, SETTLE_FRAMES } from '../src/engines/signal';
import type { Run, SignalKernel } from '../src/engines/signal/trace';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

const budget = parse(readFileSync('config/budgets.yaml', 'utf8')) as { frame_ms: number };
const modules = import.meta.glob<SignalKernel>('../src/kernels/signal/[!_]*.ts', { import: 'kernel', eager: true });
const live = ENTRIES.filter((e) => e.engine === 'signal' && e.status === 'live');
const DRAG = 30;

const cpuMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };

/** The kernel with its work counted: runs started, steps resumed, and the parameters of the last run. */
function counted(kernel: SignalKernel) {
  const c = { runs: 0, steps: 0, last: {} as Params };
  const k: SignalKernel = {
    ...kernel,
    run(params, seed, meter): Run {
      c.runs++;
      c.last = { ...params };
      const inner = kernel.run(params, seed, meter);
      return (function* steps() { for (const v of inner) { c.steps++; yield v; } })();
    },
  };
  return { c, k };
}

function context(aspect: number, params: Params, rows: { stats: Stat[] }): PlateContext {
  const ground = GROUNDS.dark;
  return {
    width: 400, height: Math.round(400 / aspect), params, seed: 4242, rnd: mulberry32(4242),
    theme: 'dark', bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => lookupPalette(String(params.palette ?? 'ember')),
    stats(s) { rows.stats = s; }, chart() {},
  };
}

const recording = (s: Stat[]) => s.some((r) => r.label === 'Recorded view' && /recording|so far/.test(r.value));

describe('signal engine: recording off the frame path', () => {
  for (const e of live) {
    const kernel = modules[`../src/kernels/signal/${e.id}.ts`];
    const ranges = (kernel.params ?? []).filter((d) => d.kind === 'range' && !d.rebuild);
    it(`${e.id}: create records nothing; a drag re-records once, after it settles`, () => {
      const { c, k } = counted(kernel);
      const code = engine.plate({ id: e.id, title: e.title, group: '' }, k);
      const params: Params = Object.fromEntries(code.params.map((d) => [d.key, d.value]));
      params.loop = false;
      const rows = { stats: [] as Stat[] };
      const sim = code.create(p5Stub(), context(code.aspect, params, rows));
      sim.setup();
      expect(c.steps, 'no step of the run inside create()').toBe(0);
      for (let f = 0; f < 5000 && (c.steps === 0 || recording(rows.stats)); f++) sim.draw();
      expect(recording(rows.stats), 'the first run finishes').toBe(false);
      for (const d of ranges) {
        if (d.kind !== 'range') continue;
        const runs = c.runs;
        let worst = 0;
        // a drag back and forth across the whole range, a new value on every frame
        const steps = Math.round((d.max - d.min) / d.step);
        const stride = Math.max(1, Math.round(steps / (DRAG / 2)));
        let at = 0; let dir = 1;
        for (let f = 0; f < DRAG; f++) {
          if (at + dir * stride < 0 || at + dir * stride > steps) dir = -dir;
          at += dir * stride;
          params[d.key] = d.min + at * d.step;
          const t = cpuMs();
          sim.draw();
          worst = Math.max(worst, cpuMs() - t);
          expect(rows.stats.length, 'a finished run stays on screen').toBeGreaterThan(1);
        }
        expect(c.runs - runs, `${d.key}: no re-record while dragging`).toBe(0);
        // the controls settle: one re-record, spread over frames, the old run shown until it is done
        let frames = 0;
        for (; frames < 5000 && (c.runs === runs || rows.stats.some((r) => r.label === 'New settings')); frames++) {
          const t = cpuMs();
          sim.draw();
          worst = Math.max(worst, cpuMs() - t);
          expect(rows.stats.some((r) => r.label === 'Recorded view' && r.value === 'recording'), 'never blank').toBe(false);
        }
        expect(c.runs - runs, `${d.key}: one re-record after the drag`).toBe(1);
        expect(frames, `${d.key}: it waits for the controls to settle`).toBeGreaterThanOrEqual(SETTLE_FRAMES);
        expect(c.last[d.key], `${d.key}: the run on screen is the one for the final setting`).toBe(params[d.key]);
        expect(worst, `${d.key}: worst frame of the drag, ${worst.toFixed(1)} ms`).toBeLessThanOrEqual(budget.frame_ms);
      }
    }, 120000);
  }
});
