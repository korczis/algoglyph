// Budget readings are context-free (test/support/budget.ts, rule project.viz-component-layer): a
// subject's reading does not depend on what ran before it in the same process. A budget file runs a
// wing's plates one after another in one process, so a plate late in the file must read what it
// reads alone, or a margin under the budget judges the file's history instead of the plate.
//
// Each probe is a child vitest process running this file in probe mode (BUDGET_ISOLATION_PROBE):
//   alone    a fresh process that reads one target and nothing else
//   in-file  a fresh process that first runs every check of CONTEXT exactly as a budget file runs
//            them (budget.ts `exercise`, judged by no one), then reads every target
// Alone and in-file probes alternate, so load on the machine reaches both alike, and the
// comparison is made within one run, never against a recorded number. The reading is the gate's
// own (budget.ts `rebuildReading`): one rebuild corner, best of the gate's repeats, in reference ms.
//
// The band is the alone reading's own spread, never chosen: 6 alone probes per target in each of
// two trees (2026-11-14, load average 13-42, rounds interleaved with the in-file probes), and the
// farthest any alone reading strayed from its target's median: 1.116 (this harness) and 1.140
// (without the untimed warm-up run of budget.ts `best`). An in-file reading agrees when it is
// within the larger, 1.14, of the alone median taken in the same run.
//
// What it measured on that day (reference ms: alone median; in-file readings; over the band):
//   without the warm-up  lorenz-attractor 18.5; 45.8 20.2 49.8 41.9 34.9 18.4; 4 of 6 (up to 2.7x)
//                        library-sort 13.5; 12.7-13.5; none   lab sorting 10.9; 9.9-15.7; 2 of 6
//   with the warm-up     lorenz-attractor 17.7; 17.1 22.3 19.8 20.0 42.4 19.1; 2 of 6 (up to 2.4x)
//                        library-sort 13.2; 12.0-13.0; none   lab sorting 9.8; 10.9-13.9; 4 of 6
// so readings are not yet context-free: the warm-up absorbs most of a predecessor's garbage
// (lorenz-attractor's in-file readings over 1.5x its alone median: 4 of 6 without, 1 of 6 with) but
// not all of it, and not the lab's steady 1.1-1.4x. Until they are, this is an instrument, not a
// gate: it runs only with BUDGET_ISOLATION=1 (about 4 minutes a round here) and becomes a gate
// when it passes.
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Params } from '../src/core/plate';
import { exercise, rebuildReading } from './support/budget';

/** Subjects that drifted in-file, at the rebuild corner nearest their budget (BUDGET_REPORT). */
const TARGETS: Record<string, Params> = {
  'lorenz-attractor': { tracers: 48, trail: 2400, sigma: 20, rho: 60, beta: 5, speed: 12, spin: true, palette: 'ember' },
  'library-sort': { shape: 'reversed', n: 512, pace: 4096, loop: true, palette: 'spectral' },
  'lab sorting': { group: 'Elementary sorts', shape: 'random', n: 256, pace: 4096, loop: true, palette: 'spectral' },
};
/** Heavier subjects, none of them a target: the nearest their budget in the same report. */
const CONTEXT = ['lab hashing', 'hash-avalanche', 'water-waves-two-slit', 'verlet-cloth', 'boids-3d',
  'lab centrality', 'bogosort', 'odd-even-sort', 'pancake-sort', 'exchange-sort'];
// BUDGET_ISOLATION_ROUNDS and BUDGET_ISOLATION_LOG serve the band's derivation (see the top)
const ROUNDS = Number(process.env.BUDGET_ISOLATION_ROUNDS ?? 3);
const BAND = 1.14;

interface Probe { before: string[]; targets: string[] }
const PROBE = process.env.BUDGET_ISOLATION_PROBE;

/** One child process: its readings of `targets`, after every check of `before`. */
function probe(before: string[], targets: string[]): number[] {
  const dir = mkdtempSync(join(tmpdir(), 'budget-isolation-'));
  const out = join(dir, 'readings.txt');
  // the child is a vitest run of its own, not a worker of this one
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITEST')));
  try {
    const r = spawnSync(process.execPath,
      ['node_modules/vitest/vitest.mjs', 'run', 'test/budget-isolation.test.ts', '--pool=forks'], {
        env: { ...env, BUDGET_ISOLATION_PROBE: JSON.stringify({ before, targets }), BUDGET_ISOLATION_OUT: out },
        encoding: 'utf8',
      });
    if (r.status !== 0) throw new Error(`probe ${JSON.stringify({ before, targets })} failed:\n${r.stdout}\n${r.stderr}`);
    return readFileSync(out, 'utf8').trim().split('\n').map(Number);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.runIf(Boolean(PROBE))('budget isolation probe', () => {
  it('reads its targets after its context', async () => {
    const p = JSON.parse(PROBE!) as Probe;
    for (const b of p.before) await exercise(b);
    for (const t of p.targets) appendFileSync(process.env.BUDGET_ISOLATION_OUT!, `${await rebuildReading(t, TARGETS[t])}\n`);
    expect(p.targets.length).toBeGreaterThan(0);
  }, 1_800_000);
});

describe.runIf(!PROBE && process.env.BUDGET_ISOLATION === '1')('budget readings do not depend on what ran before', () => {
  it('reads each target alike alone and after heavier subjects', () => {
    const labels = Object.keys(TARGETS);
    const alone: Record<string, number[]> = Object.fromEntries(labels.map((l) => [l, []]));
    const inFile: Record<string, number[]> = Object.fromEntries(labels.map((l) => [l, []]));
    for (let r = 0; r < ROUNDS; r++) {
      for (const l of labels) alone[l].push(probe([], [l])[0]);
      probe(CONTEXT, labels).forEach((ms, i) => inFile[labels[i]].push(ms));
    }
    if (process.env.BUDGET_ISOLATION_LOG) {
      appendFileSync(process.env.BUDGET_ISOLATION_LOG, `${JSON.stringify({ alone, inFile })}\n`);
    }
    for (const l of labels) {
      const mid = [...alone[l]].sort((a, b) => a - b)[Math.floor(alone[l].length / 2)];
      for (const ms of inFile[l]) {
        expect(Math.max(ms / mid, mid / ms), `${l}: in-file ${ms.toFixed(1)} reference ms against alone `
          + `${alone[l].map((x) => x.toFixed(1)).join(', ')}`).toBeLessThanOrEqual(BAND);
      }
    }
  }, 3_600_000);
});
