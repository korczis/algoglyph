// U-signal: kuramoto runs exactly as before on every seeded input (test/u-signal/same-runs.ts),
// and on a reader's series it couples one oscillator per value at that natural frequency.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../../src/core/catalogue';
import { optionValue, tableOf } from '../../src/core/data';
import type { Params } from '../../src/core/plate';
import { Meter, type View } from '../../src/engines/signal/trace';
import { kernel as now } from '../../src/kernels/signal/kuramoto';
import { kernel as before } from '../fixtures/u-signal-before/src/kernels/signal/kuramoto';
import { sameSeededRuns } from './same-runs';

sameSeededRuns('kuramoto', now, before);

// The whole seeded run of the kernel alone, every view to its end, at the defaults and every option.
it('kuramoto: every view of every seeded run, to the end, is the frozen kernel\'s', () => {
  const base: Params = Object.fromEntries(now.params!.map((d) => [d.key, d.value]));
  const corners = [base, ...now.params!.flatMap((d) => (d.kind === 'select' ? d.options.map((o) => ({ ...base, [d.key]: o.value })) : []))];
  const all = (k: typeof now, c: Params) => [...k.run({ ...c }, 7, new Meter())].filter((v) => v !== null);
  for (const c of corners) expect(all(now, c), JSON.stringify(c)).toEqual(all(before, c));
}, 120_000);

describe('kuramoto on a reader\'s natural frequencies', () => {
  const decl = ENTRIES.find((e) => e.id === 'kuramoto')!.data[0];
  const views = (omega: number[], over: Params): View[] => {
    const table = tableOf(decl, omega.map((v) => [v]));
    const params: Params = { n: 192, K: 2, dist: optionValue(decl.id), gamma: 0.5, ...over };
    return [...now.run(params, 3, new Meter(), (id) => (id === decl.id ? table : null))].filter((v): v is View => v !== null);
  };
  const stat = (v: View, label: string) => v.stats.find((s) => s.label === label)?.value;

  it('uncoupled, each oscillator turns at exactly the reader\'s frequency, one per value', () => {
    const omega = Array.from({ length: 20 }, (_, i) => 0.1 * i - 0.9);
    const last = views(omega, { K: 0 }).at(-1)!;
    const panel = last.panels[2];
    const eff = panel.kind === 'xy' ? (panel.dots ?? []).map((d) => d.y) : [];
    expect(eff.length).toBe(20);
    eff.forEach((y, i) => expect(Math.abs(y - omega[i])).toBeLessThan(1e-9));
    expect(stat(last, 'Input')).toBe('your data, 20 natural frequencies');
    expect(stat(last, 'Incoherent level 1/√N')).toBe((1 / Math.sqrt(20)).toFixed(3));
  });

  it('coupled, equal frequencies all lock; no critical coupling or theory is claimed', () => {
    const last = views(Array.from({ length: 32 }, () => 0.7), { K: 1 }).at(-1)!;
    expect(stat(last, 'Effective frequency within 0.02 of the mean (measured)')).toBe('32 of 32');
    expect(Number(stat(last, 'Order parameter r now'))).toBeGreaterThan(0.999);
    expect(stat(last, 'Critical K_c')).toMatch(/^no reference/);
    expect(last.stats.some((s) => s.label.startsWith('Theory') || s.label.includes('/ critical'))).toBe(false);
  });
});
