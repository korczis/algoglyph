// Every live plate and every runnable lab fits the main-thread budget of config/budgets.yaml
// (ADR 0004, rule project.viz-component-layer). Drawing is stubbed, so what is measured is the
// plate's own work. Three ways a plate can freeze a phone, each its own check:
//   settings  creation and the first frames at every heavy corner, at every width
//   rebuild   the frames after a run ends: a loop or a new input built inside draw()
//   drag      a slider moved without a remount: params change between frames
// The corners are derived from the plate's own controls, never listed per plate.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { CATALOGUE, ENTRIES } from '../src/core/catalogue';
import { palette as lookupPalette, GROUNDS } from '../src/core/palette';
import type { ParamDef, Params, Plate, PlateContext, Sim } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { labRunnable, loadLab, loadPlate } from '../src/registry';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

interface Budget {
  create_ms: number; frame_ms: number; frames: number; repeats: number;
  widths: number[]; horizon_frames: number; horizon_cpu_ms: number; drag_steps: number;
  reference_cpu_ms: number;
}
const budget = parse(readFileSync('config/budgets.yaml', 'utf8')) as Budget;
const widest = Math.max(...budget.widths);

/** Every range at its maximum, with the defaults for everything else. */
function base(defs: ParamDef[]): Params {
  const out: Params = {};
  for (const d of defs) out[d.key] = d.kind === 'range' ? d.max : d.value;
  return out;
}

/**
 * The heavy corners: the all-maximum base, then one variant per select option and one per range
 * at its minimum (for a cell size or a step the light end is the maximum). Linear in the number
 * of controls, so the gate stays affordable as plates grow.
 */
function corners(defs: ParamDef[]): Params[] {
  const b = base(defs);
  const out = [b];
  for (const d of defs) {
    if (d.kind === 'select') {
      for (const o of d.options) if (o.value !== b[d.key]) out.push({ ...b, [d.key]: o.value });
    } else if (d.kind === 'range' && d.min !== d.max) {
      out.push({ ...b, [d.key]: d.min });
    }
  }
  return out;
}

function context(plate: Plate, params: Params, width: number): PlateContext {
  const ground = GROUNDS.dark;
  return {
    width, height: Math.round(width / plate.aspect), params, seed: 4242, rnd: mulberry32(4242),
    theme: 'dark', bg: ground.bg, fg: ground.fg, thumbnail: false,
    palette: () => lookupPalette(String(params.palette ?? 'ember')),
    stats() {}, chart() {},
  };
}

/**
 * CPU milliseconds this process has used. Vitest runs each file in a forked process, so this is
 * the plate's own work plus its garbage collection; time the scheduler gives to other processes
 * is not in it. Wall-clock time read preemption as a slow plate: n-body measured 2.2 ms per
 * frame alone and 56 ms at a load average of 56; gray-scott 1.9 ms locally and 55 ms on CI's
 * runner while other test files ran (Pages run 43115536542).
 */
function cpuMs(): number {
  const u = process.cpuUsage();
  return (u.user + u.system) / 1000;
}

/**
 * A fixed workload (a stencil over typed arrays plus transcendental calls, the shape of most plate
 * work), timed as the best of five. Its CPU time on the machine running the gate, divided by
 * `reference_cpu_ms` measured on the reference machine, is the factor the budgets scale by: the
 * gate judges a plate's work, not the runner's speed. A shared self-hosted runner measured
 * gray-scott at 54 ms of CPU per frame against 1.9 ms on the reference machine (Pages run
 * 43118047691), which no fixed budget can tell apart from a regression.
 */
export function referenceCpuMs(): number {
  const n = 192;
  const a = new Float64Array(n * n).map((_, i) => Math.sin(i));
  const b = new Float64Array(n * n);
  let bestMs = Infinity;
  for (let r = 0; r < 5; r++) {
    const t = cpuMs();
    for (let it = 0; it < 12; it++) {
      for (let y = 1; y < n - 1; y++) {
        for (let x = 1; x < n - 1; x++) {
          const i = y * n + x;
          b[i] = 0.2 * (a[i - 1] + a[i + 1] + a[i - n] + a[i + n]) + 0.2 * Math.cos(a[i]);
        }
      }
      a.set(b);
    }
    bestMs = Math.min(bestMs, cpuMs() - t);
  }
  return bestMs;
}

let factor = 1;
const scaled = () => ({ create: budget.create_ms * factor, frame: budget.frame_ms * factor });

function frame(sim: Sim): number {
  const t = cpuMs();
  sim.draw();
  return cpuMs() - t;
}

interface Reading { create: number; frame: number; at: string }

function start(plate: Plate, params: Params, width: number): { sim: Sim; create: number } {
  const t0 = cpuMs();
  const sim = plate.create(p5Stub(), context(plate, params, width));
  sim.setup();
  sim.draw();
  return { sim, create: cpuMs() - t0 };
}

/** Creation and the first `frames` frames. */
function settings(plate: Plate, params: Params, width: number): Reading {
  const { sim, create } = start(plate, params, width);
  let worst = 0;
  for (let i = 0; i < budget.frames; i++) worst = Math.max(worst, frame(sim));
  return { create, frame: worst, at: '' };
}

/**
 * Frames well past the first window, until a run has ended and been rebuilt: up to
 * `horizon_frames` frames or `horizon_cpu_ms` of CPU, whichever comes first.
 */
function rebuild(plate: Plate, params: Params, width: number): Reading {
  const { sim } = start(plate, params, width);
  let worst = 0;
  let at = 0;
  const t0 = cpuMs();
  for (let i = 0; i < budget.horizon_frames && cpuMs() - t0 < budget.horizon_cpu_ms; i++) {
    const f = frame(sim);
    if (f > worst) { worst = f; at = i; }
  }
  return { create: 0, frame: worst, at: `frame ${at}` };
}

/**
 * Each range without `rebuild: true` swept from its minimum to its maximum, one step per frame,
 * the way an input event updates the live params during a drag. A rebuild range remounts the
 * plate on release, which the settings check already measures as creation.
 */
function drag(plate: Plate, params: Params, width: number): Reading {
  const live = { ...params };
  const { sim } = start(plate, live, width);
  let worst = 0;
  let at = '';
  for (const d of plate.params) {
    if (d.kind !== 'range' || d.rebuild || d.min === d.max) continue;
    for (let s = 0; s <= budget.drag_steps; s++) {
      live[d.key] = d.min + ((d.max - d.min) * s) / budget.drag_steps;
      const f = frame(sim);
      if (f > worst) { worst = f; at = `${d.key} = ${live[d.key]}`; }
    }
    live[d.key] = params[d.key];
  }
  return { create: 0, frame: worst, at };
}

/**
 * The best of `repeats` runs: what is left of the noise (cache and memory contention on a loaded
 * machine) varies between runs, while a plate whose work is genuinely over budget is over it in
 * every run. The worst frame inside a run is kept: periodic heavy frames recur in every run.
 */
function best(run: () => Reading): Reading {
  let out: Reading = { create: Infinity, frame: Infinity, at: '' };
  for (let r = 0; r < budget.repeats; r++) {
    const m = run();
    out = { create: Math.min(out.create, m.create), frame: Math.min(out.frame, m.frame), at: m.at || out.at };
    if (out.create <= scaled().create && out.frame <= scaled().frame) break;
  }
  return out;
}

function judge(where: string, m: Reading) {
  const at = m.at ? ` (${m.at})` : '';
  const on = factor > 1 ? `, this machine ${factor.toFixed(2)}× the reference` : '';
  const b = scaled();
  expect(m.create, `${where}: ${m.create.toFixed(0)} ms to create${on}`).toBeLessThanOrEqual(b.create);
  expect(m.frame, `${where}: ${m.frame.toFixed(1)} ms per frame${at}${on}`).toBeLessThanOrEqual(b.frame);
}

const CHECKS: Record<string, (label: string, plate: Plate) => void> = {
  settings(label, plate) {
    for (const width of budget.widths) {
      for (const params of corners(plate.params)) {
        judge(`${label} at ${width} px ${JSON.stringify(params)}`, best(() => settings(plate, params, width)));
      }
    }
  },
  rebuild(label, plate) {
    const params = base(plate.params);
    judge(`${label} past the end of a run at ${widest} px`, best(() => rebuild(plate, params, widest)));
  },
  drag(label, plate) {
    const params = base(plate.params);
    judge(`${label} during a slider drag at ${widest} px`, best(() => drag(plate, params, widest)));
  },
};

const subjects: { label: string; load: () => Promise<Plate | undefined> | undefined }[] = [
  ...ENTRIES.filter((x) => x.status === 'live').map((e) => ({ label: e.id, load: () => loadPlate(e.id) })),
  ...CATALOGUE.labs.filter((x) => labRunnable(x.id)).map((l) => ({ label: `lab ${l.id}`, load: () => loadLab(l.id) })),
];

describe('main-thread budget', () => {
  for (const s of subjects) {
    describe(s.label, () => {
      for (const [name, check] of Object.entries(CHECKS)) {
        it(name, async () => {
          // calibrated before each check, so load that comes and goes on the runner is followed
          factor = Math.max(1, referenceCpuMs() / budget.reference_cpu_ms);
          check(s.label, (await s.load())!);
        }, 300000);
      }
    });
  }
});
