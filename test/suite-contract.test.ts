// The suite's own contract: correctness tests are not judged on wall-clock time. The global
// `testTimeout` (vite.config.ts) is sized for a loaded shared runner; a test that sets a shorter
// limit of its own judges the machine, not the code. A quantum integrator test with its own 20 s
// limit took 24.5 s on the x86 runner and failed a deploy (Pages run 43142783431) though its
// physics passed. Time budgets belong to test/budget/, which measures CPU time.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';

const config = readFileSync('vite.config.ts', 'utf8');
const global = Number(/testTimeout:\s*([0-9_]+)/.exec(config)?.[1].replace(/_/g, ''));
// this file's own fixtures are examples of what it refuses
const files = readdirSync('test').filter((f) => f.endsWith('.ts') && f !== 'suite-contract.test.ts');

/** Per-test limits a file sets: `}, 20000);` closing an `it`, or `{ timeout: 20000 }`. */
export function ownLimits(source: string): number[] {
  const out: number[] = [];
  for (const m of source.matchAll(/^\s*\}, ([0-9_]+)\);\s*$/gm)) out.push(Number(m[1].replace(/_/g, '')));
  for (const m of source.matchAll(/\btimeout:\s*([0-9_]+)/g)) out.push(Number(m[1].replace(/_/g, '')));
  return out;
}

// The Rust tests follow the same contract: a time bound there only guards against a hang. A 1 s
// bound on a Rhai refusal failed a deploy at 2.4 s on the x86 runner (Pages run 43147327731).
const HANG_GUARD_S = 30;
const rustTests = readdirSync('crates').flatMap((c) => {
  const dir = join('crates', c, 'tests');
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.rs')).map((f) => join(dir, f)) : [];
});

/** Assertions that read the wall clock (performance.now, Date.now) inside expect(). */
export function wallClockAsserts(source: string): number {
  return [...source.matchAll(/expect\([^;]*\b(performance\.now|Date\.now)\(\)/g)].length;
}

/** Wall-clock bounds a Rust test sets, in seconds. */
export function rustBounds(source: string): number[] {
  const out: number[] = [];
  for (const m of source.matchAll(/Duration::from_secs\(([0-9_]+)\)/g)) out.push(Number(m[1].replace(/_/g, '')));
  for (const m of source.matchAll(/Duration::from_millis\(([0-9_]+)\)/g)) out.push(Number(m[1].replace(/_/g, '')) / 1000);
  return out;
}

describe('the test suite', () => {
  it('runs the budget gate in one file per wing, plus the labs, each in a process of its own', () => {
    // one long budget process judged a lab after ~1100 other checks and failed it on accumulated
    // state that it passed alone; the files are the catalogue's wings, derived, never chosen
    const wings = [...new Set(ENTRIES.filter((e) => e.status === 'live').map((e) => e.path[0]))].sort();
    const files = readdirSync('test/budget').filter((f) => f.endsWith('.test.ts')).map((f) => f.replace('.test.ts', '')).sort();
    expect(files).toEqual([...wings, 'labs'].sort());
  });

  it('finds a short Rust bound when one is set', () => {
    expect(rustBounds('if took >= Duration::from_secs(1) {')).toEqual([1]);
    expect(rustBounds('Duration::from_millis(500)')).toEqual([0.5]);
  });

  for (const f of rustTests) {
    it(`${f} bounds time only as a hang guard (at least ${HANG_GUARD_S} s)`, () => {
      const short = rustBounds(readFileSync(f, 'utf8')).filter((s) => s < HANG_GUARD_S);
      expect(short, `${f}: a time bound guards a hang, never a speed`).toEqual([]);
    });
  }

  it('has a global test timeout', () => {
    expect(global).toBeGreaterThan(0);
  });

  it('finds a shorter per-test limit when one is set', () => {
    expect(ownLimits("  it('x', () => {\n  }, 20000);\n")).toEqual([20000]);
    expect(ownLimits("it('x', { timeout: 5_000 }, () => {});")).toEqual([5000]);
    expect(ownLimits('    const run = drive(plate, { speed: 2000 }, 600);')).toEqual([]);
  });

  it('finds a wall-clock reading inside an assertion', () => {
    expect(wallClockAsserts('expect(performance.now() - t0).toBeLessThan(5);')).toBe(1);
    expect(wallClockAsserts('while (performance.now() < stop) {')).toBe(0);
  });

  for (const f of files.filter((x) => x !== 'budget.test.ts')) {
    it(`${f} leaves frame times to the budget gate`, () => {
      // a frame budget judged outside test/budget/ has none of its calibration or headroom:
      // two such checks failed deploys on a loaded runner (42.2 ms against a raw 40, run 43173408443)
      expect(/\bframe_ms\b/.test(readFileSync(join('test', f), 'utf8')), f).toBe(false);
    });
    it(`${f} asserts nothing about wall-clock time`, () => {
      // a wall-clock reading may end a loop, never decide a test: budgets are CPU time
      expect(wallClockAsserts(readFileSync(join('test', f), 'utf8')), f).toBe(0);
    });
  }

  for (const f of files) {
    it(`${f} sets no per-test limit shorter than the global ${global} ms`, () => {
      const short = ownLimits(readFileSync(join('test', f), 'utf8')).filter((ms) => ms < global);
      expect(short, `${f}: drop the limit; the global testTimeout applies`).toEqual([]);
    });
  }
});
