import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { FRAME_TIME, SETTLE_KE } from '../src/plates/soft-body-3d/plate';
import {
  BEND, SHEAR, STRUCTURAL, energy, forces, icosphere, lattice, momentum, preset, stableStep,
  step, volume, type SoftBody, type World,
} from '../src/plates/soft-body-3d/softbody';

const FREE: World = {
  gravity: 0, ground: false, restitution: 0, friction: 0, stiffness: 100, damping: 0, pressure: 0,
};
const FLOOR: World = { ...FREE, gravity: 9.8, ground: true, restitution: 0.3, friction: 0.6,
  damping: 0.1 };

function kick(b: SoftBody, seed: number, speed: number): void {
  const rnd = mulberry32(seed);
  for (let i = 0; i < b.n * 3; i++) b.v[i] += (rnd() - 0.5) * speed;
}

function lowest(b: SoftBody): number {
  let low = Infinity;
  for (let i = 0; i < b.n; i++) low = Math.min(low, b.x[i * 3 + 1]);
  return low;
}

describe('soft body: one spring', () => {
  it('two masses on a spring oscillate at ω = √(2k/m), from zero crossings, within 1 %', () => {
    // a 2 × 1 × 1 lattice is two masses joined by one structural spring
    const h = 0.5;
    const mass = 0.8;
    const b = lattice(2, 1, 1, h, mass);
    expect(b.springs).toBe(1);
    const w: World = { ...FREE, stiffness: 37 };
    const k = w.stiffness * h;
    const m = mass / 2;
    const omega = Math.sqrt((2 * k) / m);
    b.x[3] += 0.1 * h;
    forces(b, w);
    const dt = (2 * Math.PI) / omega / 2000;
    const crossings: number[] = [];
    let prev = Math.abs(b.x[3] - b.x[0]) - h;
    for (let s = 1; s <= 20000 && crossings.length < 9; s++) {
      step(b, w, dt);
      const u = Math.abs(b.x[3] - b.x[0]) - h;
      if (Math.sign(u) !== Math.sign(prev)) crossings.push((s - 1 + prev / (prev - u)) * dt);
      prev = u;
    }
    expect(crossings.length).toBe(9);
    // consecutive zero crossings are half a period apart
    const period = (2 * (crossings[8] - crossings[0])) / 8;
    expect(Math.abs(period - (2 * Math.PI) / omega) / ((2 * Math.PI) / omega)).toBeLessThan(0.01);
  });
});

describe('soft body: invariants', () => {
  // Measured with these seeds at the largest step the plate uses (stableStep): 3.5 % for the
  // cube and 7.2 % for the ball over 10 000 steps of a violently shaken body. The bound is
  // stated at 5 % and 10 %; halving the step divides the drift by about 4 (second order).
  const cases: [string, () => SoftBody, World, number][] = [
    ['cube lattice', () => preset('cube', 6, mulberry32(7)), FREE, 0.05],
    ['pressure ball', () => preset('ball', 6, mulberry32(7)), { ...FREE, pressure: 20 }, 0.1],
  ];
  for (const [name, build, w, bound] of cases) {
    it(`${name}: without damping, gravity or ground, energy drift stays below ${bound * 100} % `
      + 'over 10 000 steps, and is second order in the step', () => {
      const drift = (dt: number) => {
        const b = build();
        kick(b, 99, 0.6);
        forces(b, w);
        const e0 = energy(b, w).total;
        let worst = 0;
        for (let s = 0; s < 10000; s++) {
          step(b, w, dt);
          worst = Math.max(worst, Math.abs(energy(b, w).total - e0) / e0);
        }
        return worst;
      };
      const b = build();
      const dt = stableStep(b, w);
      const full = drift(dt);
      expect(full).toBeLessThan(bound);
      expect(full / drift(dt / 2)).toBeGreaterThan(3);
    }, 60000);
  }

  it('conserves momentum without external forces, with damping and gas pressure', () => {
    for (const [name, w] of [['cube', { ...FREE, damping: 0.4 }],
      ['ball', { ...FREE, damping: 0.4, pressure: 30 }]] as const) {
      const b = preset(name, 6, mulberry32(3));
      kick(b, 5, 1);
      forces(b, w);
      const p0 = momentum(b);
      const dt = stableStep(b, w);
      for (let s = 0; s < 2000; s++) step(b, w, dt);
      const p1 = momentum(b);
      for (let d = 0; d < 3; d++) expect(Math.abs(p1[d] - p0[d])).toBeLessThan(1e-12);
    }
  });

  // Measured: 4e-9 J after 5 s (from a sag worth about 1e-3 J at 1 s); the bound is 1e-6 J.
  it('a cube resting on the ground settles and never sinks below it', () => {
    const b = lattice(6, 6, 6, 0.14, 1);
    forces(b, FLOOR);
    const dt = stableStep(b, FLOOR);
    let kinetic = Infinity;
    for (let s = 0; s * dt < 5; s++) {
      step(b, FLOOR, dt);
      expect(lowest(b)).toBeGreaterThanOrEqual(0);
      kinetic = energy(b, FLOOR).kinetic;
    }
    expect(kinetic).toBeLessThan(1e-6);
  }, 30000);

  for (const name of ['cube', 'ball'] as const) {
    it(`the dropped ${name} never penetrates the floor and settles as the plate counts it`, () => {
      const w: World = { ...FLOOR, pressure: name === 'ball' ? 20 : 0 };
      const b = preset(name, 6, mulberry32(11));
      forces(b, w);
      const dt = stableStep(b, w);
      let touched = 0;
      for (let s = 0; s * dt < 15; s++) {
        touched = Math.max(touched, step(b, w, dt));
        expect(lowest(b)).toBeGreaterThanOrEqual(0);
      }
      expect(touched).toBeGreaterThan(0);
      expect(energy(b, w).kinetic).toBeLessThan(SETTLE_KE);
    }, 30000);
  }

  it('the undamped column at the default stiffness keeps its energy to 1e-5 (plate note)', () => {
    const w: World = { ...FLOOR, damping: 0 };
    for (const seed of [1, 2, 3, 4, 5]) {
      const b = preset('column', 7, mulberry32(seed));
      forces(b, w);
      const e0 = energy(b, w).total;
      const steps = Math.max(8, Math.ceil(FRAME_TIME / stableStep(b, w)));
      let contacts = 0;
      let worst = 0;
      for (let f = 0; f < 900; f++) {
        for (let s = 0; s < steps; s++) contacts += step(b, w, FRAME_TIME / steps);
        worst = Math.max(worst, Math.abs(energy(b, w).total - e0) / e0);
      }
      expect(contacts).toBe(0);
      expect(worst).toBeLessThan(1e-5);
    }
  }, 30000);

  it('stays finite at the extremes of the plate\'s controls at the plate\'s step', () => {
    for (const name of ['cube', 'ball', 'column'] as const) {
      for (const [stiffness, damping, pressure] of [[400, 0.5, 40], [40, 0, 0], [40, 0.5, 40]]) {
        const w: World = { ...FLOOR, gravity: 20, restitution: 1, stiffness, damping, pressure:
          name === 'ball' ? pressure : 0 };
        const b = preset(name, 10, mulberry32(2));
        forces(b, w);
        const dt = FRAME_TIME / Math.max(2, Math.ceil(FRAME_TIME / stableStep(b, w)));
        for (let s = 0; s * dt < 1; s++) step(b, w, dt);
        const e = energy(b, w);
        expect(Number.isFinite(e.total), `${name} ${stiffness} ${damping}`).toBe(true);
        expect(e.kinetic, `${name} ${stiffness} ${damping}`).toBeLessThan(100);
      }
    }
  }, 60000);
});

describe('soft body: builders', () => {
  it('a lattice has the springs a brute-force count of node offsets predicts', () => {
    const [nx, ny, nz] = [4, 5, 3];
    const b = lattice(nx, ny, nz, 0.1, 1);
    // classify every pair of lattice nodes by its integer offset, independently of the builder
    const expected = [0, 0, 0];
    const nodes: number[][] = [];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      nodes.push([i, j, k]);
    }
    for (let a = 0; a < nodes.length; a++) {
      for (let c = a + 1; c < nodes.length; c++) {
        const d = nodes[a].map((v, e) => Math.abs(v - nodes[c][e]));
        const sq = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
        const max = Math.max(...d);
        if (sq === 1) expected[STRUCTURAL]++;
        else if (max === 1) expected[SHEAR]++;
        else if (sq === 4 && max === 2) expected[BEND]++;
      }
    }
    const counted = [0, 0, 0];
    for (let s = 0; s < b.springs; s++) counted[b.kind[s]]++;
    expect(counted).toEqual(expected);
    // and the closed forms
    const [ex, ey, ez] = [nx - 1, ny - 1, nz - 1];
    expect(expected[STRUCTURAL]).toBe(ex * ny * nz + nx * ey * nz + nx * ny * ez);
    expect(expected[SHEAR])
      .toBe(2 * (ex * ey * nz + ex * ny * ez + nx * ey * ez) + 4 * ex * ey * ez);
    expect(expected[BEND]).toBe((nx - 2) * ny * nz + nx * (ny - 2) * nz + nx * ny * (nz - 2));
  });

  it('a lattice surface is closed, outward and encloses the box volume', () => {
    const b = lattice(4, 5, 3, 0.1, 1);
    expect(b.faces.length / 3).toBe(4 * (3 * 4 + 3 * 2 + 4 * 2));
    expect(volume(b)).toBeCloseTo(3 * 4 * 2 * 0.001, 12);
  });

  it('a geodesic sphere has Euler\'s counts and nearly a sphere\'s volume', () => {
    for (const s of [0, 1, 2, 3]) {
      const b = icosphere(s, 1, 1);
      const f = 20 * 4 ** s;
      const e = 30 * 4 ** s;
      expect(b.n).toBe(10 * 4 ** s + 2);
      expect(b.faces.length / 3).toBe(f);
      expect(b.n - e + f).toBe(2);
      let edges = 0;
      let bends = 0;
      for (let k = 0; k < b.springs; k++) {
        if (b.kind[k] === STRUCTURAL) edges++;
        if (b.kind[k] === BEND) bends++;
      }
      expect(edges).toBe(e);
      expect(bends).toBe(e);
      // an inscribed polyhedron: below the sphere, and closer to it with every subdivision
      expect(volume(b)).toBeLessThan((4 / 3) * Math.PI);
      if (s === 3) expect(volume(b)).toBeGreaterThan(0.98 * (4 / 3) * Math.PI);
    }
  });

  it('fixed seeds reproduce the experiment and other seeds differ', () => {
    const run = (seed: number) => {
      const b = preset('cube', 5, mulberry32(seed));
      forces(b, FLOOR);
      for (let s = 0; s < 400; s++) step(b, FLOOR, 1e-3);
      return Array.from(b.x);
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });
});
