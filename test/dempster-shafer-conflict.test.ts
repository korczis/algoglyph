// Dempster–Shafer's plate: total conflict (K = 1) is reachable, and when it is met the plate
// publishes that the combination is undefined. The note says so ("At K = 1 … the rule is
// undefined there, and the plate says so"); with mass kept on Θ by every source, Θ ∩ Θ always
// keeps some product and K = 1 could never happen.
import { describe, expect, it } from 'vitest';
import { trace, type StochasticKernel } from '../src/engines/stochastic/trace';
import { kernel, type DempsterResult } from '../src/kernels/stochastic/dempster-shafer';

const run = (params: Record<string, number>, seed: number) =>
  trace(kernel as StochasticKernel<DempsterResult>, params, seed);

describe('dempster-shafer total conflict', () => {
  it('keeps no mass on Θ when the least mass on Θ is 0', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = run({ sources: 6, ignorance: 0 }, seed).result;
      for (const m of r.sources) {
        expect(m[7], `seed ${seed}`).toBe(0);
        expect(m.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      }
    }
  });

  it('reaches K = 1 and publishes the undefined readout', () => {
    let reached = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const t = run({ sources: 8, ignorance: 0 }, seed);
      const r = t.result;
      if (r.undefinedAt < 0) continue;
      reached++;
      expect(r.combined, `seed ${seed}`).toBeNull();
      expect(r.conflicts[r.undefinedAt - 1]).toBeGreaterThanOrEqual(1 - 1e-12);
      const last = t.frames[t.frames.length - 1].stats;
      const value = (label: string) => last.find((s) => s.label === label)?.value;
      expect(value('Combination'), `seed ${seed}`).toMatch(/^undefined/);
      expect(value('Conflict K of the last combination')).toMatch(/total conflict$/);
    }
    expect(reached, 'some seed meets total conflict').toBeGreaterThan(0);
  });

  it('never meets total conflict while every source keeps mass on Θ', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = run({ sources: 10, ignorance: 0.05 }, seed).result;
      expect(r.undefinedAt, `seed ${seed}`).toBe(-1);
      for (const m of r.sources) expect(m[7]).toBeGreaterThanOrEqual(0.05 - 1e-12);
    }
  });
});
