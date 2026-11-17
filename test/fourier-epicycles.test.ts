// fourier-epicycles beyond the entry's claims (catalogue/entries/fourier-epicycles.md). Each claim's
// expected value is a closed form of a known curve, checked here against the formula and never
// against the plate: the heart's radii in 34ths, the trefoil's three circles from
// cos²(3a) = (1 + cos 6a)/2, and the sampled square's spectrum from its second difference, which is
// zero but at the four corners, so |X_k| ∝ 1/sin²(πk/N) on k ≡ 1 (mod 4) and 0 elsewhere. A planted
// slip in the transform must fail every claim through the same instrument, and the default run
// must draw and read exactly what the plate drew and read before the pass
// (test/fixtures/fourier-epicycles-before), a planted change of one unit in the last place shown
// to break that comparison.
import { describe, expect, it, vi } from 'vitest';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import type { Params, PlateCode, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { dft } from '../src/plates/fourier-epicycles/dft';
import { fourierEpicycles as plateNew, shape } from '../src/plates/fourier-epicycles/plate';
import { fourierEpicycles as plateOld } from './fixtures/fourier-epicycles-before/plate';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from './support/claims';

const ID = 'fourier-epicycles';
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claims = model.entries.find((e) => e.id === ID)!.claims;
const claim = (id: string) => {
  const c = claims.find((x) => x.id === id);
  if (!c) throw new Error(`${ID} has no claim ${id}`);
  return c;
};

/** The trefoil r = 0.35 + 0.65 cos²(3a) as circles: 0.675 at f = 1, 0.1625 at f = 7 and f = −5. */
const TREFOIL = [[1, 0.675], [7, 0.1625], [-5, 0.1625]] as const;
/** The sampled square's circle at f = k, relative to the one at f = 1. */
const squareRadius = (k: number, n: number) => Math.sin(Math.PI / n) ** 2 / Math.sin((Math.PI * k) / n) ** 2;
/** The square's signed frequencies k ≡ 1 (mod 4) in the plate's range (−N/2, N/2]. */
const squareFreqs = (n: number) => Array.from({ length: n }, (_, i) => i - n / 2 + 1).filter((k) => ((k - 1) % 4 + 4) % 4 === 0);
/** RMS error over size of the largest `m` circles, by Parseval, from the radii alone. */
function parsevalError(radii: number[], m: number): number {
  const sorted = [...radii].sort((a, b) => b - a);
  const all = sorted.reduce((s, r) => s + r * r, 0);
  const kept = sorted.slice(0, m).reduce((s, r) => s + r * r, 0);
  return 100 * Math.sqrt(Math.max(0, all - kept) / all);
}
const squareError = (n: number, m: number) => parsevalError(squareFreqs(n).map((k) => squareRadius(k, n)), m);

describe('fourier-epicycles: the claims are the closed forms', () => {
  it('the trefoil is three circles: r e^(ia) = 0.675 e^(ia) + 0.1625 (e^(7ia) + e^(−5ia))', () => {
    for (let i = 0; i < 97; i++) {
      const a = (2 * Math.PI * i) / 97;
      const r = 0.35 + 0.65 * Math.cos(3 * a) ** 2;
      let x = 0;
      let y = 0;
      for (const [f, c] of TREFOIL) { x += c * Math.cos(f * a); y += c * Math.sin(f * a); }
      expect(x).toBeCloseTo(r * Math.cos(a), 14);
      expect(y).toBeCloseTo(r * Math.sin(a), 14);
    }
    const radii = TREFOIL.map(([, c]) => c);
    expect(claim('trefoil-one-circle').expect.value).toBeCloseTo(parsevalError(radii, 1), 3);
    expect(claim('trefoil-exact-with-three-circles').expect.value).toBe(0);
    expect(claim('trefoil-second-circle').expect.value).toBeCloseTo(0.1625 / 0.675, 6);
  });

  it('the heart\'s second circle is 6/25 of its largest (radii 25, 6, 5, 5, 2, 1, 1, 1 in 34ths)', () => {
    expect(claim('heart-second-circle').expect.value).toBe(6 / 25);
  });

  it('the sampled square\'s circles are 1/sin²(πk/N) on k ≡ 1 (mod 4), and the claims read them', () => {
    expect(claim('square-second-circle').expect.value).toBeCloseTo(squareRadius(-3, 256), 6);
    expect(claim('square-second-circle-at-64-samples').expect.value).toBeCloseTo(squareRadius(-3, 64), 6);
    expect(claim('square-one-circle').expect.value).toBeCloseTo(squareError(256, 1), 3);
    // the continuous square's 1/k² law is the limit, and the claims' tolerance tells them apart
    for (const id of ['square-second-circle', 'square-second-circle-at-64-samples']) {
      const c = claim(id);
      expect(Math.abs((c.expect.value as number) - 1 / 9)).toBeGreaterThan(10 * (c.expect.tolerance as number));
    }
  });

  it('the plate\'s transform of the square is the closed form to rounding, at every sample count', () => {
    for (const n of [64, 128, 256]) {
      const [xs, ys] = shape('square', mulberry32(1), n);
      const terms = dft(xs, ys);
      const one = terms.find((t) => t.freq === 1)!.amp;
      const on = new Set(squareFreqs(n));
      for (const t of terms) expect(Math.abs(t.amp / one - (on.has(t.freq) ? squareRadius(t.freq, n) : 0))).toBeLessThan(1e-12);
    }
  });
});

describe('fourier-epicycles: a planted slip in the transform fails every claim', () => {
  it('the inner sum stopping one sample short moves every claim\'s reading out of its band', async () => {
    vi.resetModules();
    vi.doMock('../src/plates/fourier-epicycles/dft', async (orig) => {
      const m = await orig<typeof import('../src/plates/fourier-epicycles/dft')>();
      return { ...m, dft: (xs: Float64Array, ys: Float64Array) => {
        // the planted slip: the last sample left out of the sum, the 1/N kept
        const n = xs.length;
        const terms = m.dft(xs.subarray(0, n - 1), ys.subarray(0, n - 1));
        return terms.map((t) => ({ ...t, re: (t.re * (n - 1)) / n, im: (t.im * (n - 1)) / n, amp: (t.amp * (n - 1)) / n }));
      } };
    });
    const planted = await import('./support/claims');
    const held: string[] = [];
    for (const c of claims) {
      const f = await planted.failures(ID, c);
      if (f.length === 0) held.push(c.id);
      // a reading outside the band, never a run that read nothing
      for (const m of f) expect(m, c.id).toMatch(/" read .* expected /);
    }
    vi.doUnmock('../src/plates/fourier-epicycles/dft');
    vi.resetModules();
    expect(held, 'claims the planted slip did not fail').toEqual([]);
  });
});

/** A p5 that records every call with its exact arguments: what the plate drew, to the last bit. */
function recorder() {
  const calls: unknown[] = [];
  const p = new Proxy({}, {
    get(_t, key) {
      if (typeof key !== 'string') return undefined;
      if (/^[A-Z_]+$/.test(key)) return key;
      return (...args: unknown[]) => { calls.push([key, ...args]); };
    },
  });
  return { p: p as never, calls };
}

/** Every draw call and readout of the default run, frame by frame, without the rows the pass added. */
function run(plate: PlateCode, frames: number, over: Params = {}): unknown[] {
  const params: Params = {};
  for (const d of plate.params) params[d.key] = d.value;
  Object.assign(params, over);
  const { p, calls } = recorder();
  let rows: Stat[] = [];
  const ctx: PlateContext = {
    width: 1440, height: Math.round(1440 / plate.aspect), params, seed: 4242, rnd: mulberry32(4242),
    theme: 'dark', bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail: false,
    palette: () => lookupPalette(String(params.palette)), stats(r) { rows = r; }, chart() {},
  };
  const sim = plate.create(p, ctx);
  sim.setup();
  const out: unknown[] = [];
  for (let f = 0; f < frames; f++) {
    sim.draw();
    out.push(calls.splice(0), rows.filter((r) => r.label !== 'second circle / largest'));
  }
  return out;
}

describe('fourier-epicycles: the default run is unchanged by the pass', () => {
  // 300 frames: more than a full turn of the chain (256 frames at speed 1) and the trail's cap
  const FRAMES = 300;

  it('draws and reads exactly what the plate before the pass drew and read', () => {
    expect(run(plateNew, FRAMES)).toEqual(run(plateOld, FRAMES));
  });

  it('the comparison sees a planted change of one unit in the last place of the speed', () => {
    expect(run(plateNew, FRAMES, { speed: 1 + Number.EPSILON })).not.toEqual(run(plateOld, FRAMES));
  });
});
