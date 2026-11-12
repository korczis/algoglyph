// The shared two-slit models (src/plates/_shared/two-slit/), each against a reference computed a
// different way: published values of the special functions, the complex amplitudes summed
// directly, a finer Simpson cumulative for Born sampling, the closed-form contrast factors for the
// detector grid, and the closed forms of a Gaussian wall for the recoil model.
import { describe, expect, it } from 'vitest';
import { GROUNDS, palette } from '../src/core/palette';
import { defaults, type Params, type PlateContext, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { CATALOGUE } from '../src/core/catalogue';
import { loadPlate } from '../src/registry';
import {
  compare, fire, mergedBins, MIN_BINS, MIN_EXPECTED, tally, type Gun,
} from '../src/plates/_shared/two-slit/ballistic';
import {
  attenuation, gridReading, sampledKernel, CELLS_PER_PERIOD,
} from '../src/plates/_shared/two-slit/detector';
import {
  besselJ0, chiSquareQuantile, erf, interpolate, ksBound, ksDistance, sinc, Z_999,
} from '../src/plates/_shared/two-slit/math';
import { CALM, FASTEST, FPS, Pacer, roundRobin, RUN_WINDOW_S } from '../src/plates/_shared/two-slit/pace';
import { closedForm, uncertaintyRatio, Wall } from '../src/plates/_shared/two-slit/recoil';
import { installBrowserStubs, p5Stub } from './support/p5-stub';
import {
  envelope, fringePeriod, referenceCdf, Screen, twoSlit, visibilityMoments, VisibilityEstimate,
  type Slits,
} from '../src/plates/_shared/two-slit/screen';

describe('two-slit math', () => {
  it('sinc, erf and J0 match published values', () => {
    expect(sinc(0)).toBe(1);
    expect(sinc(Math.PI)).toBeCloseTo(0, 15);
    // Abramowitz and Stegun, table 7.1
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 13);
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 13);
    expect(erf(2)).toBeCloseTo(0.9953222650189527, 13);
    expect(erf(-1)).toBeCloseTo(-0.8427007929497149, 13);
    expect(erf(3.5)).toBeCloseTo(0.9999992569016276, 12);
    expect(erf(5)).toBeCloseTo(0.9999999999984626, 14);
    // Abramowitz and Stegun, table 9.1, and the first zero j₀,₁
    expect(besselJ0(1)).toBeCloseTo(0.7651976865579666, 12);
    expect(besselJ0(5)).toBeCloseTo(-0.1775967713143383, 12);
    expect(besselJ0(10)).toBeCloseTo(-0.2459357644513483, 11);
    expect(besselJ0(15)).toBeCloseTo(-0.0142244728267808, 8);
    expect(besselJ0(20)).toBeCloseTo(0.1670246643405831, 8);
    expect(besselJ0(2.404825557695773)).toBeCloseTo(0, 12);
  });

  it('the Wilson–Hilferty χ² points are within 1.5 % of the tabulated ones', () => {
    // χ²₂₀ at 0.1 % and 99.9 %: 5.921 and 45.315; χ²₅₀: 24.674 and 86.661
    expect(chiSquareQuantile(20, -Z_999) / 5.921).toBeCloseTo(1, 1);
    expect(Math.abs(chiSquareQuantile(20, Z_999) / 45.315 - 1)).toBeLessThan(0.015);
    expect(Math.abs(chiSquareQuantile(50, -Z_999) / 24.674 - 1)).toBeLessThan(0.015);
    expect(Math.abs(chiSquareQuantile(50, Z_999) / 86.661 - 1)).toBeLessThan(0.015);
  });
});

/** 50 eV electrons, slits 0.5 µm wide and 2.5 µm apart, screen 1 m away. */
const ELECTRONS: Slits = { lambda: 1.734e-10, d: 2.5e-6, a: 0.5e-6, L: 1 };

describe('two-slit far-field amplitudes', () => {
  it('|ψ₁ + e^{iθ}ψ₂|², summed as complex numbers, is the closed form e(x)(1 + cos(2πx/Λ + θ))', () => {
    const s = ELECTRONS;
    const amp = (x: number, sign: number) => {
      const u = (Math.PI * s.a * x) / (s.lambda * s.L);
      const m = Math.sqrt(s.a / (2 * s.lambda * s.L)) * (u === 0 ? 1 : Math.sin(u) / u);
      const ph = (sign * Math.PI * s.d * x) / (s.lambda * s.L);
      return [m * Math.cos(ph), m * Math.sin(ph)];
    };
    for (const theta of [0, 1, Math.PI, -2.2]) {
      for (const x of [0, 1e-5, -3.3e-5, 2.2e-4, 5e-4]) {
        const [r1, i1] = amp(x, -1);
        const [r2, i2] = amp(x, 1);
        const re = r1 + r2 * Math.cos(theta) - i2 * Math.sin(theta);
        const im = i1 + r2 * Math.sin(theta) + i2 * Math.cos(theta);
        const want = re * re + im * im;
        expect(Math.abs(twoSlit(s, x, theta) - want)).toBeLessThan(1e-9 * envelope(s, 0));
      }
    }
  });

  it('Born sampling: the sampler’s own discretisation is under a tenth of the KS bound, and its hits pass KS', () => {
    const s = ELECTRONS;
    const screen = new Screen(s);
    const N = 20_000;
    const X = screen.X;
    const reference = referenceCdf(s, X, 1);
    const ref = (x: number) => interpolate(reference, -X, X, x);
    // the density the sampler actually draws: the envelope at each table cell's midpoint, times
    // (1 + cos), integrated on 16 sub-points per cell
    const cells = 4096;
    const h = (2 * X) / cells;
    const k = (2 * Math.PI) / fringePeriod(s);
    const implied = new Float64Array(cells * 16 + 1);
    let acc = 0;
    for (let i = 0; i < cells; i++) {
      const e = envelope(s, -X + (i + 0.5) * h);
      for (let j = 0; j < 16; j++) {
        const x = -X + (i + (j + 0.5) / 16) * h;
        acc += (e * (1 + Math.cos(k * x)) * h) / 16;
        implied[i * 16 + j + 1] = acc;
      }
    }
    let gap = 0;
    for (let i = 0; i < implied.length; i++) {
      const x = -X + (i / (implied.length - 1)) * 2 * X;
      gap = Math.max(gap, Math.abs(implied[i] / acc - ref(x)));
    }
    expect(gap).toBeLessThan(0.1 * ksBound(N));

    const rnd = mulberry32(4242);
    const xs = new Float64Array(N);
    for (let i = 0; i < N; i++) xs[i] = screen.fringe(rnd, 0);
    // a fixed seed makes this deterministic; another seed fails it about 5 times in 100
    expect(ksDistance(xs, ref)).toBeLessThan(ksBound(N));
  });

  it('a photon scattered in the plane leaves the visibility J₀(kd), sign included', () => {
    const s = ELECTRONS;
    const screen = new Screen(s);
    const est = new VisibilityEstimate(screen.period, visibilityMoments(s, screen.X));
    const rnd = mulberry32(7);
    const kd = 3.8; // between the first two zeros of J₀: reversed fringes
    for (let i = 0; i < 40_000; i++) {
      const theta = kd * Math.sin(2 * Math.PI * rnd());
      const r = screen.emitTwo(rnd, theta);
      if (r.outcome === 'hit') est.add(r.x);
    }
    const { v, se } = est.value();
    expect(besselJ0(kd)).toBeLessThan(0);
    expect(Math.abs(v - besselJ0(kd))).toBeLessThan(4 * se);
  });
});

describe('two-slit detector resolution', () => {
  it('every sampled kernel is non-negative and sums to 1', () => {
    for (const [kind, w] of [['gaussian', 0.3], ['gaussian', 3.9], ['box', 1.43], ['box', 40]] as const) {
      const k = sampledKernel(kind, w, 1 / CELLS_PER_PERIOD);
      expect(Math.min(...k)).toBeGreaterThanOrEqual(0);
      expect(Math.abs(k.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-12);
    }
  });

  it('the grid run measures the closed-form contrast factor, a box’s reversal included', () => {
    for (const w of [0.05, 0.2, 0.3, 0.5]) {
      const r = gridReading('gaussian', w)!;
      expect(Math.abs(r.vMeasured - attenuation('gaussian', w))).toBeLessThan(1e-6);
    }
    for (const w of [0.5, 1.43, 2.5, 7.3]) {
      const r = gridReading('box', w)!;
      // the box's edges on a 64-cell grid: under 0.1 % of the contrast
      expect(Math.abs(r.vMeasured - attenuation('box', w))).toBeLessThan(1e-3);
    }
    expect(gridReading('box', 1.43)!.vMeasured).toBeLessThan(-0.2);
    const r = gridReading('gaussian', 0.3)!;
    expect(Math.abs(r.vTrue - 1)).toBeLessThan(1e-12);
    expect(Math.abs(r.normError)).toBeLessThan(1e-9);
    expect(gridReading('gaussian', 5)).toBeNull();
  });
});

describe('two-slit recoiling wall', () => {
  it('a Gaussian wall has σₓσₚ = ħ/2 on the grid, the chirped one (ħ/2)√5', () => {
    for (const sp of [0.05, 0.3, 1, 10]) {
      const g = new Wall('gaussian', sp).spreads();
      expect(Math.abs(2 * g.dx * g.dk - 1)).toBeLessThan(1e-6);
      const c = new Wall('chirped', sp).spreads();
      expect(Math.abs((2 * c.dx * c.dk) / uncertaintyRatio('chirped') - 1)).toBeLessThan(1e-4);
    }
  });

  it('the numerical overlap and the smeared fringe give the closed-form visibility', () => {
    for (const state of ['gaussian', 'chirped'] as const) {
      for (const sp of [0.2, 0.5, 2]) {
        const w = new Wall(state, sp);
        const g = w.overlap();
        const v = Math.hypot(g.re, g.im);
        expect(Math.abs(v - closedForm(state, sp).v)).toBeLessThan(1e-6);
        expect(Math.abs(w.smearedContrast() - v)).toBeLessThan(1e-9);
      }
    }
  });

  it('a momentum reading distinguishes the paths by erf(Δq/2√2σₚ), and D² + V² < 1', () => {
    for (const sp of [0.1, 0.25, 0.5, 1, 3]) {
      const w = new Wall('gaussian', sp);
      const d = w.distinguishability();
      const cf = closedForm('gaussian', sp);
      expect(Math.abs(d - cf.d)).toBeLessThan(2e-3);
      expect(d * d + cf.v * cf.v).toBeLessThan(1);
    }
    const c = new Wall('chirped', 0.5);
    const v = Math.hypot(c.overlap().re, c.overlap().im);
    expect(c.distinguishability() ** 2 + v * v).toBeLessThan(1);
    // the limits: a wall of sharp momentum keeps no fringes, a wall of sharp position all of them
    expect(closedForm('gaussian', 0.05).v).toBeLessThan(1e-3);
    expect(closedForm('gaussian', 10).v).toBeGreaterThan(0.99);
  });
});

const GUN: Gun = {
  spread: (12 * Math.PI) / 180, a: 0.02, d: 0.06, ricochet: (10 * Math.PI) / 180,
  L1: 1, L2: 1, Y: 0.6, bins: 48,
};

describe('two-slit bullets', () => {
  const run = (open: 'one' | 'two' | 'both', seed: number, n: number) => {
    const t = tally(GUN);
    const rnd = mulberry32(seed);
    for (let i = 0; i < n; i++) fire(GUN, open, rnd, t);
    return t;
  };

  it('every bullet is counted once: emitted = blocked + detected + missed', () => {
    for (const open of ['one', 'two', 'both'] as const) {
      const t = run(open, 3, 5000);
      expect(t.blocked + t.detected + t.missed).toBe(t.emitted);
      expect(t.hist.reduce((a, b) => a + b, 0)).toBe(t.detected);
    }
  });

  it('merged bins each expect at least the minimum count', () => {
    const e = Float64Array.from([0, 1, 2, 9, 30, 3, 40, 12, 1, 0.5]);
    for (const [a, b] of mergedBins(e)) {
      let s = 0;
      for (let i = a; i < b; i++) s += e[i];
      expect(s).toBeGreaterThanOrEqual(MIN_EXPECTED);
    }
  });

  it('n₁₂ is consistent with n₁ + n₂, and the same test rejects interference', () => {
    const n = 40_000;
    const c = compare(GUN, run('one', 11, n).hist, run('two', 12, n).hist, run('both', 13, n).hist,
      (4 * 2 * GUN.Y) / GUN.bins);
    expect(c.additive).toBeGreaterThan(c.band[0]);
    expect(c.additive).toBeLessThan(c.band[1]);
    expect(c.coherent).toBeGreaterThan(10 * c.band[1]);
    expect(c.k).toBeGreaterThanOrEqual(MIN_BINS);
  });

  it('states its sensitivity: fringes of the found visibility sit on the band’s ceiling', () => {
    const n = 40_000;
    const period = (4 * 2 * GUN.Y) / GUN.bins;
    const n1 = run('one', 11, n).hist;
    const n2 = run('two', 12, n).hist;
    const n12 = run('both', 13, n).hist;
    const c = compare(GUN, n1, n2, n12, period);
    expect(c.sensitivity).toBeGreaterThan(0);
    expect(c.sensitivity).toBeLessThan(1);
    // the statistic at that visibility, recomputed here bin group by bin group, is the ceiling
    const expected = n1.map((v, i) => v + n2[i]);
    const groups = mergedBins(expected);
    let chi = 0;
    for (const [a, b] of groups) {
      let o = 0;
      let m = 0;
      for (let i = a; i < b; i++) {
        const y = -GUN.Y + ((i + 0.5) / GUN.bins) * 2 * GUN.Y;
        o += n12[i];
        m += n1[i] + n2[i] + 2 * c.sensitivity * Math.sqrt(n1[i] * n2[i]) * Math.cos((2 * Math.PI * y) / period);
      }
      let sum = 0;
      for (let i = a; i < b; i++) sum += n1[i] + n2[i];
      chi += (o - m) ** 2 / Math.max(1, o + sum);
    }
    expect(chi / groups.length / c.band[1]).toBeCloseTo(1, 9);
    // more bullets, a sharper test
    const big = compare(GUN, run('one', 21, 4 * n).hist, run('two', 22, 4 * n).hist, run('both', 23, 4 * n).hist, period);
    expect(big.sensitivity).toBeLessThan(c.sensitivity);
  });
});

installBrowserStubs();

/** Every readout of a plate run to the end at one pace (headless, drawing stubbed). */
async function finalReadouts(id: string, setup: Params, rate: number): Promise<Stat[]> {
  const plate = (await loadPlate(id))!;
  const params = { ...defaults(plate), ...setup, rate };
  let rows: Stat[] = [];
  const ctx: PlateContext = {
    width: 800, height: 500, params, seed: 4242, rnd: mulberry32(4242), theme: 'dark',
    bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail: false, palette: () => palette('abyss'),
    stats(r) { rows = r; }, chart() {},
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  let last = '';
  let still = 0;
  for (let f = 0; f < 40_000 && still < 60; f++) {
    sim.draw();
    const now = JSON.stringify(rows);
    still = now === last ? still + 1 : 0;
    last = now;
  }
  return rows;
}

describe('two-slit pace', () => {
  it('carries fractions: the calm default lands under 30 particles a second at 60 frames a second', () => {
    const p = new Pacer();
    let total = 0;
    for (let f = 0; f < 600; f++) total += p.take(CALM);
    expect(total / 10).toBeLessThanOrEqual(30);
    expect(total / 10).toBeGreaterThan(20);
  });

  it('shares single steps among runs across frames, and stops at their ends', () => {
    const done = [0, 0, 0];
    const left = (r: number) => 4 - done[r];
    for (let f = 0; f < 6; f++) roundRobin(1, left, 3, (r) => { done[r]++; });
    expect(done).toEqual([2, 2, 2]);
    roundRobin(100, left, 3, (r) => { done[r]++; });
    expect(done).toEqual([4, 4, 4]);
  });

  it('changes how fast a run is drawn, never what it measures', async () => {
    const cases: [string, Params][] = [
      ['two-slit-classical', { n: 1000 }],
      ['two-slit-amplitudes', { scenario: 'electrons', n: 2000 }],
      ['two-slit-amplitudes', { scenario: 'watched', n: 2000, eta: 0.5 }],
      ['two-slit-amplitudes', { scenario: 'recoil', n: 2000 }],
    ];
    for (const [id, setup] of cases) {
      expect(await finalReadouts(id, setup, CALM), `${id} ${JSON.stringify(setup)}`)
        .toEqual(await finalReadouts(id, setup, FASTEST));
    }
  }, 120_000);
});

/** The frame on which a plate's readouts last changed, run at its defaults and the given setup. */
async function lastChange(id: string, setup: Params): Promise<number> {
  const plate = (await loadPlate(id))!;
  const params = { ...defaults(plate), ...setup };
  let rows: Stat[] = [];
  const ctx: PlateContext = {
    width: 800, height: 500, params, seed: 4242, rnd: mulberry32(4242), theme: 'dark',
    bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg, thumbnail: false, palette: () => palette('abyss'),
    stats(r) { rows = r; }, chart() {},
  };
  const sim = plate.create(p5Stub(), ctx);
  sim.setup();
  let last = '';
  let changed = 0;
  for (let f = 1; f <= (RUN_WINDOW_S[1] + 30) * FPS && f - changed < 600; f++) {
    sim.draw();
    const now = JSON.stringify(rows);
    if (now !== last) changed = f;
    last = now;
  }
  return changed;
}

describe('two-slit default runs', () => {
  // every default a reader can open: each plate mode, and each figure page's setup
  const runs: [string, Params][] = [
    ['two-slit-classical', {}],
    ...['electrons', 'watched', 'resolution', 'recoil'].map((scenario) => ['two-slit-amplitudes', { scenario }] as [string, Params]),
    ...CATALOGUE.chapters.flatMap((c) => c.figures.map((f) => [f.plate, f.setup] as [string, Params])),
  ];

  it('end within the calm window, counted in frames at the calm pace', async () => {
    const [lo, hi] = RUN_WINDOW_S.map((x) => x * FPS);
    for (const [id, setup] of runs) {
      const frames = await lastChange(id, setup);
      expect(frames, `${id} ${JSON.stringify(setup)}: last readout change at frame ${frames}`).toBeGreaterThanOrEqual(lo);
      expect(frames, `${id} ${JSON.stringify(setup)}: last readout change at frame ${frames}`).toBeLessThanOrEqual(hi);
    }
  }, 300_000);
});
