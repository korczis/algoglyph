// Every live plate and every runnable lab fits the main-thread budget of config/budgets.yaml at
// its heaviest settings: each range at its maximum, each select option in turn. Drawing is
// stubbed, so what is measured is the plate's own work (ADR 0004, rule project.viz-component-layer).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { CATALOGUE, ENTRIES } from '../src/core/catalogue';
import { palette as lookupPalette, GROUNDS } from '../src/core/palette';
import type { ParamDef, Params, Plate, PlateContext } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { labRunnable, loadLab, loadPlate } from '../src/registry';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

const budget = parse(readFileSync('config/budgets.yaml', 'utf8')) as {
  create_ms: number; frame_ms: number; frames: number; repeats: number;
};

/** The heaviest settings: every range at its maximum, then one variant per select option. */
function heaviest(defs: ParamDef[]): Params[] {
  const base: Params = {};
  for (const d of defs) base[d.key] = d.kind === 'range' ? d.max : d.value;
  const out = [base];
  for (const d of defs) {
    if (d.kind !== 'select') continue;
    for (const o of d.options) if (o.value !== base[d.key]) out.push({ ...base, [d.key]: o.value });
  }
  return out;
}

function context(plate: Plate, params: Params): PlateContext {
  const ground = GROUNDS.dark;
  return {
    width: 400, height: Math.round(400 / plate.aspect), params, seed: 4242, rnd: mulberry32(4242),
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

function once(plate: Plate, params: Params): { create: number; frame: number } {
  const t0 = cpuMs();
  const sim = plate.create(p5Stub(), context(plate, params));
  sim.setup();
  sim.draw();
  const create = cpuMs() - t0;
  let frame = 0;
  for (let i = 0; i < budget.frames; i++) {
    const t = cpuMs();
    sim.draw();
    frame = Math.max(frame, cpuMs() - t);
  }
  return { create, frame };
}

/**
 * The best of `repeats` runs: what is left of the noise (cache and memory contention on a loaded
 * machine) varies between runs, while a plate whose work is genuinely over budget is over it in
 * every run. The worst frame inside a run is kept: periodic heavy frames recur in every run.
 */
function measure(plate: Plate, params: Params): { create: number; frame: number } {
  let best = { create: Infinity, frame: Infinity };
  for (let r = 0; r < budget.repeats; r++) {
    const m = once(plate, params);
    best = { create: Math.min(best.create, m.create), frame: Math.min(best.frame, m.frame) };
    if (best.create <= budget.create_ms && best.frame <= budget.frame_ms) break;
  }
  return best;
}

async function check(label: string, plate: Plate) {
  for (const params of heaviest(plate.params)) {
    const m = measure(plate, params);
    const where = `${label} ${JSON.stringify(params)}`;
    expect(m.create, `${where}: ${m.create.toFixed(0)} ms to create`).toBeLessThanOrEqual(budget.create_ms);
    expect(m.frame, `${where}: ${m.frame.toFixed(1)} ms per frame`).toBeLessThanOrEqual(budget.frame_ms);
  }
}

describe('main-thread budget at the heaviest settings', () => {
  for (const e of ENTRIES.filter((x) => x.status === 'live')) {
    it(`plate ${e.id}`, async () => { await check(e.id, (await loadPlate(e.id))!); }, 120000);
  }
  for (const l of CATALOGUE.labs.filter((x) => labRunnable(x.id))) {
    it(`lab ${l.id}`, async () => { await check(`lab ${l.id}`, (await loadLab(l.id))!); }, 120000);
  }
});
