// pareto-front's spread across the diagonal becomes a control (S4 B3): the correlated and
// anti-correlated options were drawn as 0.5 + 0.15 (u ± 0.35 v), u and v standard normals; the
// 0.35 is now the control `spread`, the same draws in the same order, so the default is the old
// option set. Checked: the control exists with the old constant as its default, it travels in a
// shared link, and it drives what the plate reads: at 0 every correlated option lies on the
// diagonal x = y, so one option dominates all the others (front 1, n layers), and every
// anti-correlated option on the line x + y = 1, where none dominates another (front n, one
// layer); at 1 both criteria are independent normals, u + v and ±(u − v), so the front is the
// number of records of a random permutation, mean H_n and variance H_n − H_n⁽²⁾.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { front2, kernel, layers, options } from '../src/kernels/numeric/pareto-front';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'pareto-front';
const KEY = 'spread';
const defOf = () => kernel.params?.find((d) => d.key === KEY);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect: { range: [-1e12, 1e12] }, setup: { params: params as Record<string, number> } });
type Draw = (kind: string, n: number, seed: number, spread?: number) => [number, number][];
const draw = options as unknown as Draw;
const harmonic = (n: number, p = 1) => Array.from({ length: n }, (_, i) => 1 / (i + 1) ** p).reduce((a, b) => a + b, 0);

describe('pareto-front: spread across the diagonal', () => {
  it('is a range control with the old constant as its default, shown unless the criteria are independent', () => {
    expect(defOf()).toMatchObject({
      kind: 'range', label: 'Spread across the diagonal', min: 0, max: 1, step: 0.05, value: 0.35, rebuild: true,
      when: { key: 'shape', values: ['correlated', 'anti'] },
    });
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID))!.params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0, 0.6, 1]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('at 0 the options lie on a line: one front option when correlated, every option when anti-correlated', () => {
    for (const n of [10, 160, 600]) {
      for (const seed of [1, 7, 4242]) {
        const cor = draw('correlated', n, seed, 0);
        const anti = draw('anti', n, seed, 0);
        for (const [x, y] of cor) expect(x).toBe(y);
        expect(front2(cor)).toHaveLength(1);
        expect(Math.max(...layers(cor)) + 1).toBe(n);
        expect(front2(anti)).toHaveLength(n);
        expect(Math.max(...layers(anti)) + 1).toBe(1);
      }
    }
  });

  it('at 1 the front is the records of a random permutation, mean H_n', () => {
    const n = 160;
    const runs = 2000;
    const sd = Math.sqrt(harmonic(n) - harmonic(n, 2));
    for (const kind of ['correlated', 'anti']) {
      let sum = 0;
      for (let s = 1; s <= runs; s++) sum += front2(draw(kind, n, 1000 + s, 1)).length;
      expect(Math.abs(sum / runs - harmonic(n)), kind).toBeLessThan((4 * sd) / Math.sqrt(runs));
    }
  });

  it('drives the readouts at both ends', async () => {
    const at = async (readout: string, params: Params) => {
      const r = await read(ID, claim(readout, { options: 160, ...params }));
      expect(r.reason).toBeUndefined();
      return r.value!;
    };
    expect(await at('Front', { shape: 'correlated', [KEY]: 0 })).toBe(1);
    expect(await at('Layers (non-dominated sorting)', { shape: 'correlated', [KEY]: 0 })).toBe(160);
    expect(await at('Front', { shape: 'anti', [KEY]: 0 })).toBe(160);
    expect(await at('Layers (non-dominated sorting)', { shape: 'anti', [KEY]: 0 })).toBe(1);
    const sd = Math.sqrt(harmonic(160) - harmonic(160, 2));
    for (const shape of ['correlated', 'anti']) {
      const f = await at('Front', { shape, [KEY]: 1 });
      expect(f).toBeGreaterThanOrEqual(1);
      expect(f).toBeLessThanOrEqual(harmonic(160) + 3 * sd);
    }
  });
});

describe('pareto-front at its default is what it was before the control', () => {
  // integers only (fronts and layers), recorded on the code before the control existed (5f091c7)
  const FRONTS = '48e50e867db5d4da';
  const cases = ['independent', 'correlated', 'anti'].flatMap((kind) => [10, 160, 600].flatMap((n) => [1, 4242].map((seed) => [kind, n, seed] as const)));

  it('every shape draws the same fronts and layers', () => {
    const all = cases.map(([kind, n, seed]) => { const pts = options(kind, n, seed); return [kind, n, seed, front2(pts), layers(pts)]; });
    expect(hash(all)).toBe(FRONTS);
  });

  it('passing the default explicitly draws the same options', () => {
    for (const [kind, n, seed] of cases) expect(draw(kind, n, seed, 0.35), `${kind} ${n} ${seed}`).toEqual(options(kind, n, seed));
    const p = { options: 160, shape: 'anti' };
    expect(kernel.run({ seed: 4242, params: { ...p, [KEY]: 0.35 } })).toEqual(kernel.run({ seed: 4242, params: p }));
  });
});
