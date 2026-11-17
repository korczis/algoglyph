// The rigid body (src/plates/_shared/rigid) beyond the entry's claims: the measured order of the
// splitting under step halving (2 for Strang, 4 for Yoshida's triple jump), the closed forms of
// oracles.ts against a second, unrelated integrator (the shared RK4 on Euler's equations and on
// the reduced top's u̇² = f(u)), the principal axes of point masses against a box's moments
// turned by a known rotation, and a reader's body run by the plate.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { optionValue, parseData } from '../src/core/data';
import { GROUNDS, palette } from '../src/core/palette';
import { defaults, type Params, type PlateContext, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { Rk4 } from '../src/plates/_shared/ode/ode';
import { freePeriod, growthRate, topMotion, wobblePeriod } from '../src/plates/_shared/rigid/oracles';
import {
  boxMoments, energy, identity, leanX, principal, spatial, step, toVertical, type Body, type RigidState,
} from '../src/plates/_shared/rigid/rigid';
import { spinningBodies as plate } from '../src/plates/spinning-bodies/plate';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

const BOX = boxMoments(1, 2, 3).sort((x, y) => x - y) as [number, number, number];

/** A free body spun at |ω| = 1 about axis k, tilted towards axis j: its state, L stood upright. */
function spun(I: [number, number, number], k: number, j: number, tilt: number): RigidState {
  const w = [0, 0, 0];
  w[k] = Math.cos(tilt);
  w[j] = Math.sin(tilt);
  const L = Float64Array.from(w.map((v, i) => v * I[i]));
  return { R: toVertical(L), L };
}

const copy = (s: RigidState): RigidState => ({ R: Float64Array.from(s.R), L: Float64Array.from(s.L) });

/** The distance between two states after time T: orientation and momentum together. */
function gap(a: RigidState, b: RigidState): number {
  let d = 0;
  for (let i = 0; i < 9; i++) d = Math.max(d, Math.abs(a.R[i] - b.R[i]));
  for (let i = 0; i < 3; i++) d = Math.max(d, Math.abs(a.L[i] - b.L[i]));
  return d;
}

function runFor(body: Body, s0: RigidState, T: number, n: number, order: 2 | 4): RigidState {
  const s = copy(s0);
  for (let i = 0; i < n; i++) step(body, s, T / n, order);
  return s;
}

/** The order p measured by halving: log₂(e(h)/e(h/2)), each error against a run at h/64. */
function measuredOrder(body: Body, s0: RigidState, T: number, n: number, order: 2 | 4): number {
  const ref = runFor(body, s0, T, n * 64, order);
  const e1 = gap(runFor(body, s0, T, n, order), ref);
  const e2 = gap(runFor(body, s0, T, 2 * n, order), ref);
  return Math.log2(e1 / e2);
}

describe('spinning-bodies: the splitting', () => {
  const free: Body = { I: BOX, sym: -1, mgl: 0 };
  const top: Body = { I: [1, 1, 0.5], sym: 2, mgl: 10 };
  const topStart = (): RigidState => ({ R: leanX(0.5), L: Float64Array.from([0, 0, 0.5 * 20]) });

  it('is of order 2 by Strang and 4 by the triple jump, for a free body and for the top', () => {
    const s0 = spun(BOX, 1, 2, 0.3);
    expect(measuredOrder(free, s0, 4, 40, 2)).toBeCloseTo(2, 0);
    expect(Math.abs(measuredOrder(free, s0, 4, 40, 2) - 2)).toBeLessThan(0.2);
    expect(Math.abs(measuredOrder(free, s0, 4, 40, 4) - 4)).toBeLessThan(0.2);
    expect(Math.abs(measuredOrder(top, topStart(), 1, 100, 2) - 2)).toBeLessThan(0.2);
    expect(Math.abs(measuredOrder(top, topStart(), 1, 100, 4) - 4)).toBeLessThan(0.2);
  });

  it('keeps L in space and |L| to round-off for a free body, and L_z and L₃ for the top', () => {
    const s = spun(BOX, 1, 2, 0.02);
    const L0 = spatial(s);
    for (let i = 0; i < 20000; i++) step(free, s, 0.01);
    const L1 = spatial(s);
    for (let i = 0; i < 3; i++) expect(Math.abs(L1[i] - L0[i])).toBeLessThan(1e-12);
    const t = topStart();
    const z0 = spatial(t)[2];
    const l30 = t.L[2];
    const E0 = energy(top, t);
    for (let i = 0; i < 20000; i++) step(top, t, 1e-3);
    expect(Math.abs(spatial(t)[2] - z0)).toBeLessThan(1e-10);
    expect(t.L[2]).toBe(l30);
    expect(Math.abs(energy(top, t) - E0) / E0).toBeLessThan(1e-10);
  });

  it('moves ω in the body as RK4 on Euler\'s equations does, through a flip', () => {
    const s = spun(BOX, 1, 2, 0.05);
    const y = Float64Array.from([0, 1, 2].map((i) => s.L[i] / BOX[i]));
    const rk = new Rk4(3);
    const I = BOX;
    const f = (_t: number, w: Float64Array, out: Float64Array) => {
      out[0] = ((I[1] - I[2]) * w[1] * w[2]) / I[0];
      out[1] = ((I[2] - I[0]) * w[2] * w[0]) / I[1];
      out[2] = ((I[0] - I[1]) * w[0] * w[1]) / I[2];
    };
    let least = 1;
    for (let i = 0; i < 30000; i++) { step(free, s, 1e-3); rk.step(f, i * 1e-3, y, 1e-3); least = Math.min(least, y[1]); }
    for (let i = 0; i < 3; i++) expect(Math.abs(s.L[i] / BOX[i] - y[i])).toBeLessThan(1e-9);
    // it has flipped: ω₂ went through −|ω| within the 30 s
    expect(least).toBeLessThan(-0.9);
  });

  it('turns the free symmetric body exactly: its state after T does not depend on the step', () => {
    const disc: Body = { I: [0.25, 0.25, 0.5], sym: 2, mgl: 0 };
    const s0 = spun([0.25, 0.25, 0.5], 2, 1, 0.4);
    expect(gap(runFor(disc, s0, 10, 7, 4), runFor(disc, s0, 10, 7000, 4))).toBeLessThan(1e-11);
  });
});

describe('spinning-bodies: the closed forms against RK4', () => {
  /** Euler's equations for ω, by the shared RK4: the period between upward zeros of ω₂. */
  function rk4Period(I: number[], w0: number[], T: number): number {
    const f = (_t: number, y: Float64Array, out: Float64Array) => {
      out[0] = ((I[1] - I[2]) * y[1] * y[2]) / I[0];
      out[1] = ((I[2] - I[0]) * y[2] * y[0]) / I[1];
      out[2] = ((I[0] - I[1]) * y[0] * y[1]) / I[2];
    };
    const rk = new Rk4(3);
    const y = Float64Array.from(w0);
    const h = 1e-3;
    const ups: number[] = [];
    for (let i = 0; i * h < T; i++) {
      const prev = y[1];
      rk.step(f, i * h, y, h);
      if (prev < 0 && y[1] >= 0) ups.push(i * h + (-prev / (y[1] - prev)) * h);
    }
    return (ups[ups.length - 1] - ups[0]) / (ups.length - 1);
  }

  it('has the elliptic period of Euler\'s top on both sides of the separatrix', () => {
    for (const [k, j, tilt] of [[2, 1, 0.4], [0, 1, 0.4], [1, 2, 0.05], [1, 0, 0.05]]) {
      const w = [0, 0, 0];
      w[k] = Math.cos(tilt);
      w[j] = Math.sin(tilt);
      const L = w.map((v, i) => v * BOX[i]);
      const T = freePeriod(BOX, L).period;
      expect(Math.abs(rk4Period(BOX, w, 4.5 * T) - T) / T).toBeLessThan(1e-8);
    }
  });

  it('tends to the small wobble about a stable axis, and its growth rate matches the linearised flow', () => {
    for (const k of [0, 2] as const) {
      const w = [0, 0, 0];
      w[k] = Math.cos(1e-4);
      w[1] = Math.sin(1e-4);
      const T = freePeriod(BOX, w.map((v, i) => v * BOX[i])).period;
      expect(Math.abs(T - wobblePeriod(BOX, k, 1)) / T).toBeLessThan(1e-7);
    }
    // ω₁, ω₃ near the middle axis at ω₂ = 1: d²ω₁/dt² = λ²ω₁ with λ² from the two linear equations
    const [I1, I2, I3] = BOX;
    expect(growthRate(BOX, 1) ** 2).toBeCloseTo(((I2 - I3) * (I1 - I2)) / (I1 * I3), 14);
  });

  /** The reduced top ü = f′(u)/2 by RK4 from the start: its period, and the mean of φ̇ over it. */
  function rk4Top(Ip: number, mgl: number, s: RigidState) {
    const a = s.L[2] / Ip;
    const Lz = spatial(s)[2];
    const b = Lz / Ip;
    const beta = (2 * mgl) / Ip;
    const E = energy({ I: [Ip, Ip, 1], sym: 2, mgl }, { R: s.R, L: Float64Array.from([s.L[0], s.L[1], 0]) });
    const alpha = (2 * E) / Ip;
    // f(u) = (α − βu)(1 − u²) − (b − au)², f′(u) = −β(1 − u²) − 2u(α − βu) + 2a(b − au)
    const df = (u: number) => -beta * (1 - u * u) - 2 * u * (alpha - beta * u) + 2 * a * (b - a * u);
    const f = (_t: number, y: Float64Array, out: Float64Array) => {
      out[0] = y[1];
      out[1] = df(y[0]) / 2;
      out[2] = (b - a * y[0]) / (1 - y[0] * y[0]);
    };
    const rk = new Rk4(3);
    const y = Float64Array.from([s.R[8], 0, 0]);
    const h = 1e-5;
    const bottoms: [number, number][] = [];
    for (let i = 0; bottoms.length < 4; i++) {
      const prev = y[1];
      const phi = y[2];
      rk.step(f, i * h, y, h);
      if (prev < 0 && y[1] >= 0) { const q = -prev / (y[1] - prev); bottoms.push([i * h + q * h, phi + q * (y[2] - phi)]); }
    }
    const n = bottoms.length - 1;
    return { nutation: (bottoms[n][0] - bottoms[0][0]) / n, precession: (bottoms[n][1] - bottoms[0][1]) / (bottoms[n][0] - bottoms[0][0]) };
  }

  it('has the reduced top\'s nutation period and mean precession, from rest and leaning either way', () => {
    for (const [lean, w3, mgl] of [[0.5, 20, 10], [2.6, 8, 3], [1.2, 40, 1]]) {
      const s: RigidState = { R: leanX(lean), L: Float64Array.from([0, 0, 0.5 * w3]) };
      const tm = topMotion(1, mgl, s.R, s.L);
      const rk = rk4Top(1, mgl, s);
      expect(Math.abs(tm.nutation - rk.nutation) / rk.nutation).toBeLessThan(1e-7);
      expect(Math.abs(tm.precession - rk.precession) / rk.precession).toBeLessThan(1e-7);
      // the start is a root of f, the axis's highest lean (cos θ₀ = u₂)
      expect(tm.roots[1]).toBeCloseTo(Math.cos(lean), 12);
    }
  });
});

describe('spinning-bodies: principal axes', () => {
  it('finds a box\'s moments and axes from its corners turned by any rotation', () => {
    const rnd = mulberry32(5);
    for (let trial = 0; trial < 5; trial++) {
      const R = identity();
      const L = Float64Array.from([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
      R.set(toVertical(L));
      const [a, b, c] = [1 + rnd(), 2 + rnd(), 3.5 + rnd()];
      const pts: number[][] = [[], [], [], []];
      for (let i = 0; i < 8; i++) {
        const p = [(i & 1 ? 1 : -1) * a / 2, (i & 2 ? 1 : -1) * b / 2, (i & 4 ? 1 : -1) * c / 2];
        for (let r = 0; r < 3; r++) pts[r].push(7 + R[3 * r] * p[0] + R[3 * r + 1] * p[1] + R[3 * r + 2] * p[2]);
        pts[3].push(0.25);
      }
      const pr = principal(pts[0], pts[1], pts[2], pts[3]);
      // corner masses of 2 in all: Σ m(y² + z²) = 2·(b² + c²)/4, ascending
      const want = [(b * b + c * c) / 2, (a * a + c * c) / 2, (a * a + b * b) / 2].sort((x, y) => x - y);
      pr.I.forEach((v, i) => expect(v).toBeCloseTo(want[i], 12));
      expect(pr.centre[0]).toBeCloseTo(7, 12);
      // the axis of the smallest moment is the box's longest side, c, turned by R
      const axis = [pr.V[0], pr.V[3], pr.V[6]];
      expect(Math.abs(axis[0] * R[2] + axis[1] * R[5] + axis[2] * R[8])).toBeCloseTo(1, 12);
    }
  });
});

describe('spinning-bodies: a reader\'s body', () => {
  const decl = ENTRIES.find((e) => e.id === 'spinning-bodies')!.data[0];
  function drive(over: Params, csv: string | null): Stat[] {
    const table = csv === null ? null : (() => { const r = parseData(decl, csv); if (!r.ok) throw new Error(JSON.stringify(r.errors)); return r.table; })();
    const params: Params = { ...defaults(plate as never), pace: 4096, body: optionValue('points'), ...over };
    let rows: Stat[] = [];
    const ctx: PlateContext = {
      width: 800, height: 500, params, seed: 1, rnd: mulberry32(1), theme: 'dark', bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg,
      thumbnail: false, palette: () => palette('spectral'), stats(r) { rows = r; }, chart() {}, data: () => table,
    };
    const sim = plate.create(p5Stub(), ctx);
    sim.setup();
    for (let i = 0; i < 5000 && !sim.pace!().done; i++) sim.draw();
    sim.draw();
    return rows;
  }
  const value = (rows: Stat[], label: string) => rows.find((r) => r.label === label)?.value ?? '';

  it('spins the body its point masses make, with the moments of the 1 × 2 × 3 box', () => {
    const corners = Array.from({ length: 8 }, (_, i) => `${i & 1 ? 0.5 : -0.5},${i & 2 ? 1 : -1},${i & 4 ? 1.5 : -1.5},1`);
    const rows = drive({ time: 120 }, `x,y,z,m\n${corners.join('\n')}`);
    expect(value(rows, 'Input')).toMatch(/^your data, 8 points/);
    // the corners' moments are 3× the solid box's, and the plate divides by the largest
    const moments = value(rows, 'principal moments I₁ ≤ I₂ ≤ I₃').split(', ').map(Number);
    BOX.forEach((v, i) => expect(moments[i]).toBeCloseTo(v / BOX[2], 8));
    const measured = Number(value(rows, 'period of the body’s motion, measured between upward zeros of ω₂ (s)'));
    const closed = Number(value(rows, 'period of the body’s motion 4K(k)·√(I₁I₂I₃/((I₃ − I₂)(L² − 2EI₁))) (s)'));
    expect(Math.abs(measured - closed)).toBeLessThan(1e-6);
  });

  it('says why it does not run a body on a line, and asks for data when none is attached', () => {
    const line = drive({}, 'x,y,z,m\n0,0,0,1\n1,1,1,1\n2,2,2,1');
    expect(value(line, 'Input')).toContain('lie on a line');
    expect(value(drive({}, null), 'Input')).toBe('your data: none attached; attach a table of x, y, z, m');
  });
});
