import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  cloth, integrate, step, type Cloth, type Forces, type Scene,
} from '../src/plates/verlet-cloth/cloth';
import { verletCloth } from '../src/plates/verlet-cloth/plate';
import type { RangeParam } from '../src/core/plate';

// ---------------------------------------------------------------------------------------------
// The frozen reference: the simulation of src/plates/verlet-cloth/plate.ts as it was before the
// integrator moved into cloth.ts, copied verbatim with only the drawing removed. It is the
// pre-refactor oracle the module must match bit for bit; it is not used anywhere else.
// ---------------------------------------------------------------------------------------------

interface Link {
  a: number;
  b: number;
  rest: number;
}

type LegacyParams = {
  setup: string; res: number; iterations: number; gravity: number; wind: number;
};

function legacyCloth(params: LegacyParams, ctx: { rnd: () => number }) {
  const num = (_p: LegacyParams, k: 'res' | 'iterations' | 'gravity' | 'wind') => params[k];
  const str = (_p: LegacyParams, _k: 'setup') => params.setup;
  let cols = 40;
  let rows = 40;
  let pos!: Float64Array;
  let prev!: Float64Array;
  let pinned!: Uint8Array;
  let links: Link[] = [];
  let sphere: { x: number; y: number; z: number; r: number } | null = null;
  let floor = 0;
  let t = 0;
  let strain = 0;

  const idx = (i: number, j: number) => j * cols + i;

  const relax = () => {
    let sum = 0;
    for (const l of links) {
      const a = l.a * 3;
      const b = l.b * 3;
      const dx = pos[b] - pos[a];
      const dy = pos[b + 1] - pos[a + 1];
      const dz = pos[b + 2] - pos[a + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
      const diff = (d - l.rest) / d;
      sum += Math.abs(d - l.rest) / l.rest;
      const wa = pinned[l.a] ? 0 : pinned[l.b] ? 1 : 0.5;
      const wb = pinned[l.b] ? 0 : pinned[l.a] ? 1 : 0.5;
      pos[a] += dx * diff * wa;
      pos[a + 1] += dy * diff * wa;
      pos[a + 2] += dz * diff * wa;
      pos[b] -= dx * diff * wb;
      pos[b + 1] -= dy * diff * wb;
      pos[b + 2] -= dz * diff * wb;
    }
    return sum / links.length;
  };

  const collide = () => {
    for (let k = 0; k < cols * rows; k++) {
      const o = k * 3;
      if (sphere) {
        const dx = pos[o] - sphere.x;
        const dy = pos[o + 1] - sphere.y;
        const dz = pos[o + 2] - sphere.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const r = sphere.r * 1.03;
        if (d < r && d > 0) {
          const s = r / d;
          pos[o] = sphere.x + dx * s;
          pos[o + 1] = sphere.y + dy * s;
          pos[o + 2] = sphere.z + dz * s;
        }
      }
      if (pos[o + 1] > floor) {
        pos[o + 1] = floor;
        // friction on the floor: lose most of the tangential motion
        prev[o] = pos[o] - (pos[o] - prev[o]) * 0.2;
        prev[o + 2] = pos[o + 2] - (pos[o + 2] - prev[o + 2]) * 0.2;
      }
    }
  };

  return {
    state: () => ({ pos, prev, strain, links }),
    setup() {
      cols = rows = num(params, 'res');
      const n = cols * rows;
      pos = new Float64Array(n * 3);
      prev = new Float64Array(n * 3);
      pinned = new Uint8Array(n);
      const scene = str(params, 'setup');
      const top = -rows * 0.55;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = idx(i, j) * 3;
          pos[k] = i - (cols - 1) / 2;
          if (scene === 'drape') {
            pos[k + 1] = top - 2;
            pos[k + 2] = j - (rows - 1) / 2;
          } else {
            // hung horizontally, so it swings down when released
            pos[k + 1] = top;
            pos[k + 2] = j;
          }
        }
      }
      // a tiny seeded wrinkle breaks the symmetry of a perfectly flat sheet
      for (let k = 0; k < n * 3; k++) pos[k] += (ctx.rnd() - 0.5) * 0.02;
      prev.set(pos);
      if (scene === 'curtain') for (let i = 0; i < cols; i++) pinned[idx(i, 0)] = 1;
      if (scene === 'corners') {
        pinned[idx(0, 0)] = 1;
        pinned[idx(cols - 1, 0)] = 1;
      }
      sphere = scene === 'drape' ? { x: 0, y: top + rows * 0.42, z: 0, r: rows * 0.24 } : null;
      floor = top + rows * 1.15;
      links = [];
      const link = (a: number, b: number) => {
        const dx = pos[b * 3] - pos[a * 3];
        const dy = pos[b * 3 + 1] - pos[a * 3 + 1];
        const dz = pos[b * 3 + 2] - pos[a * 3 + 2];
        links.push({ a, b, rest: Math.sqrt(dx * dx + dy * dy + dz * dz) });
      };
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          if (i < cols - 1) link(idx(i, j), idx(i + 1, j));
          if (j < rows - 1) link(idx(i, j), idx(i, j + 1));
          if (i < cols - 1 && j < rows - 1) {
            link(idx(i, j), idx(i + 1, j + 1));
            link(idx(i + 1, j), idx(i, j + 1));
          }
        }
      }
      t = 0;
    },
    /** The simulation half of the old draw(): two steps per frame. */
    draw() {
      const g = num(params, 'gravity') * 0.012;
      const wind = num(params, 'wind') * 0.004;
      const iterations = num(params, 'iterations');
      for (let s = 0; s < 2; s++) {
        t += 1;
        for (let k = 0; k < cols * rows; k++) {
          if (pinned[k]) continue;
          const o = k * 3;
          const gust = wind * (0.6 + 0.4 * Math.sin(t * 0.021 + pos[o] * 0.15 + pos[o + 1] * 0.1));
          for (let d = 0; d < 3; d++) {
            const x = pos[o + d];
            const acc = d === 1 ? g : d === 2 ? gust : 0;
            pos[o + d] = x + (x - prev[o + d]) * 0.995 + acc;
            prev[o + d] = x;
          }
        }
        for (let it = 0; it < iterations; it++) {
          strain = relax();
          collide();
        }
      }
    },
  };
}

// --- end of the frozen reference ------------------------------------------------------------

/** What plate.ts does per frame with the module: two steps at the sliders' scaled forces. */
function frame(c: Cloth, p: LegacyParams): void {
  const f: Forces = { gravity: p.gravity * 0.012, wind: p.wind * 0.004, iterations: p.iterations };
  for (let s = 0; s < 2; s++) step(c, f);
}

function sameBits(a: Float64Array, b: Float64Array): boolean {
  return Buffer.from(a.buffer, a.byteOffset, a.byteLength)
    .equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));
}

describe('verlet-cloth: cloth.ts reproduces the pre-refactor plate bit for bit', () => {
  const cases: [string, LegacyParams, number][] = [
    ['default drape', { setup: 'drape', res: 40, iterations: 8, gravity: 1, wind: 0.6 }, 4242],
    ['curtain at the maxima',
      { setup: 'curtain', res: 56, iterations: 24, gravity: 3, wind: 3 }, 7],
    ['hammock at the minima',
      { setup: 'corners', res: 12, iterations: 1, gravity: 0, wind: 0 }, 99],
    ['drape, heavy', { setup: 'drape', res: 30, iterations: 3, gravity: 2.5, wind: 1.7 }, 123456],
  ];
  for (const [name, params, seed] of cases) {
    it(`${name}: same positions, previous positions and strain after every frame`, () => {
      const lp = { ...params };
      const old = legacyCloth(lp, { rnd: mulberry32(seed) });
      old.setup();
      const p = { ...params };
      const c = cloth(p.res, p.setup as Scene, mulberry32(seed));
      expect(c.rest.length).toBe(old.state().links.length);
      for (let f = 0; f < 120; f++) {
        // a slider drag halfway through: the live parameters change under both runs
        if (f === 60) {
          for (const q of [lp, p]) {
            q.iterations = Math.max(1, q.iterations - 1);
            q.gravity += 0.35;
            q.wind += 0.2;
          }
        }
        old.draw();
        frame(c, p);
        const s = old.state();
        const same = sameBits(c.pos, s.pos) && sameBits(c.prev, s.prev) && Object.is(c.strain, s.strain);
        if (!same) {
          throw new Error(`${name}: state diverged at frame ${f}`);
        }
      }
      expect(sameBits(c.pos, old.state().pos)).toBe(true);
    }, 60000);
  }
});

// ---------------------------------------------------------------------------------------------
// Physics, against references written here: the analytic free fall, the rest lengths of a unit
// grid, and the requirement that pinned points never move.
// ---------------------------------------------------------------------------------------------

/** One free particle, no links, no sphere, the floor out of reach. */
function particle(x0: number[], prev0: number[]): Cloth {
  return {
    cols: 1, rows: 1,
    pos: Float64Array.from(x0), prev: Float64Array.from(prev0), pinned: new Uint8Array(1),
    la: new Uint32Array(0), lb: new Uint32Array(0), rest: new Float64Array(0),
    sphere: null, floor: Infinity, t: 0, strain: 0,
  };
}

/** Mean relative stretch |d − rest| / rest over every link, measured here from the positions. */
function stretch(c: Cloth): number {
  let sum = 0;
  for (let k = 0; k < c.rest.length; k++) {
    const a = c.la[k] * 3;
    const b = c.lb[k] * 3;
    const { pos } = c;
    const d = Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]);
    sum += Math.abs(d - c.rest[k]) / c.rest[k];
  }
  return sum / c.rest.length;
}

/** A slider's maximum, read from the plate's own controls. */
const max = (key: string) => (verletCloth.params.find((p) => p.key === key) as RangeParam).max;
/** Every slider at its maximum, scaled per step as plate.ts scales it. */
const heaviest = (): Forces => ({
  gravity: max('gravity') * 0.012, wind: max('wind') * 0.004, iterations: max('iterations'),
});

describe('verlet-cloth: position Verlet with distance constraints', () => {
  it('a free particle follows x(t) = x0 + v0 t + ½ g t² exactly (undamped)', () => {
    const g = 0.036;
    const x0 = [1.5, -4, 2];
    const v0 = [0.03, -0.2, -0.01];
    // Verlet starts from the position one step earlier: x(−1) = x0 − v0 + ½ g along y
    const c = particle(x0, [x0[0] - v0[0], x0[1] - v0[1] + 0.5 * g, x0[2] - v0[2]]);
    for (let n = 1; n <= 500; n++) {
      integrate(c, g, 0, 1);
      const want = [x0[0] + v0[0] * n, x0[1] + v0[1] * n + 0.5 * g * n * n, x0[2] + v0[2] * n];
      for (let d = 0; d < 3; d++) {
        expect(Math.abs(c.pos[d] - want[d])).toBeLessThan(1e-9 * Math.max(1, Math.abs(want[d])));
      }
    }
  });

  it('builds unit structural links and √2 shear links (the seeded wrinkle aside)', () => {
    const c = cloth(16, 'curtain', mulberry32(3));
    let structural = 0;
    let shear = 0;
    for (const r of c.rest) {
      if (Math.abs(r - 1) < 0.04) structural++;
      else if (Math.abs(r - Math.SQRT2) < 0.04) shear++;
    }
    expect(structural).toBe(2 * 16 * 15);
    expect(shear).toBe(2 * 15 * 15);
  });

  it('the links converge: the mean stretch falls as the constraint iterations rise', () => {
    const counts = [1, 2, 4, 8, 16, 24];
    const errors = counts.map((iterations) => {
      const c = cloth(24, 'curtain', mulberry32(11));
      const f: Forces = { gravity: 3 * 0.012, wind: 0.6 * 0.004, iterations };
      for (let s = 0; s < 60; s++) step(c, f);
      return stretch(c);
    });
    for (let i = 1; i < errors.length; i++) {
      expect(errors[i], `${counts[i]} iterations against ${counts[i - 1]}`)
        .toBeLessThan(errors[i - 1]);
    }
    expect(errors[errors.length - 1]).toBeLessThan(0.2 * errors[0]);
  });

  for (const scene of ['curtain', 'corners'] as Scene[]) {
    it(`pinned points never move (${scene}, every slider at its maximum)`, () => {
      const c = cloth(max('res'), scene, mulberry32(5));
      const fixed: [number, number[]][] = [];
      for (let k = 0; k < c.pinned.length; k++) {
        if (c.pinned[k]) fixed.push([k, [c.pos[k * 3], c.pos[k * 3 + 1], c.pos[k * 3 + 2]]]);
      }
      expect(fixed.length).toBe(scene === 'curtain' ? max('res') : 2);
      const f = heaviest();
      for (let s = 0; s < 200; s++) step(c, f);
      for (const [k, p] of fixed) {
        expect([c.pos[k * 3], c.pos[k * 3 + 1], c.pos[k * 3 + 2]]).toEqual(p);
      }
    }, 60000);
  }

  for (const scene of ['drape', 'curtain', 'corners'] as Scene[]) {
    it(`no NaN at the slider maxima (${scene})`, () => {
      const c = cloth(max('res'), scene, mulberry32(8));
      const f = heaviest();
      for (let s = 0; s < 300; s++) step(c, f);
      expect(c.pos.every(Number.isFinite)).toBe(true);
      expect(c.prev.every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(c.strain)).toBe(true);
    }, 60000);
  }
});
