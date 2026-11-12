// The suite's own contract: correctness tests are not judged on wall-clock time. The global
// `testTimeout` (vite.config.ts) is sized for a loaded shared runner; a test that sets a shorter
// limit of its own judges the machine, not the code. A quantum integrator test with its own 20 s
// limit took 24.5 s on the x86 runner and failed a deploy (Pages run 43142783431) though its
// physics passed. Time budgets belong to test/budget.test.ts, which measures CPU time.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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

describe('the test suite', () => {
  it('has a global test timeout', () => {
    expect(global).toBeGreaterThan(0);
  });

  it('finds a shorter per-test limit when one is set', () => {
    expect(ownLimits("  it('x', () => {\n  }, 20000);\n")).toEqual([20000]);
    expect(ownLimits("it('x', { timeout: 5_000 }, () => {});")).toEqual([5000]);
    expect(ownLimits('    const run = drive(plate, { speed: 2000 }, 600);')).toEqual([]);
  });

  for (const f of files) {
    it(`${f} sets no per-test limit shorter than the global ${global} ms`, () => {
      const short = ownLimits(readFileSync(join('test', f), 'utf8')).filter((ms) => ms < global);
      expect(short, `${f}: drop the limit; the global testTimeout applies`).toEqual([]);
    });
  }
});
