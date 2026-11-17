// vector-algebra (catalogue/entries/vector-algebra.md) beyond the entry's claims: the turned axes
// are orthonormal and right-handed, the identities hold over the sliders' whole ranges, the triple
// product turns with the determinant, and two planted slips fail every claim between them.
import { describe, expect, it, vi } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { apply, cross, det, dot, frame, norm, read, sub, type M3, type V3 } from '../src/plates/vector-algebra/vectors';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from './support/claims';

const ID = 'vector-algebra';
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claims = model.entries.find((e) => e.id === ID)!.claims;

const rnd = mulberry32(11);
const vec = (): V3 => [rnd() * 10 - 5, rnd() * 10 - 5, rnd() * 10 - 5];
const angles = () => [rnd() * 360 - 180, rnd() * 180 - 90, rnd() * 360 - 180] as const;

describe('vector-algebra: the new axes', () => {
  it('are orthonormal, with determinant +1, or −1 when mirrored', () => {
    for (let i = 0; i < 300; i++) {
      const [y, p, r] = angles();
      for (const mirror of [false, true]) {
        const m = frame(y, p, r, mirror);
        for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) expect(dot(m[j], m[k])).toBeCloseTo(j === k ? 1 : 0, 14);
        expect(det(m)).toBeCloseTo(mirror ? -1 : 1, 14);
      }
    }
  });

  it('are the old axes at zero angles, and yaw 90° turns x onto the old y', () => {
    const id = frame(0, 0, 0, false);
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) expect(id[j][k]).toBeCloseTo(j === k ? 1 : 0, 15);
    const q = frame(90, 0, 0, false);
    expect(q[0][1]).toBeCloseTo(1, 15);
    expect(q[1][0]).toBeCloseTo(-1, 15);
  });
});

describe('vector-algebra: the identities over the sliders\' whole ranges', () => {
  it('hold within the roundings of numbers up to 75² over 2000 settings', () => {
    let lag = 0; let perp = 0; let inv = 0; let turn = 0;
    for (let i = 0; i < 2000; i++) {
      const a = vec(); const b = vec();
      const [y, p, r] = angles();
      const m = frame(y, p, r, i % 2 === 1);
      const x = read(a, b, m);
      lag = Math.max(lag, Math.abs(dot(x.ab, x.ab) - (dot(a, a) * dot(b, b) - dot(a, b) ** 2)));
      perp = Math.max(perp, Math.abs(dot(x.ab, a)) + Math.abs(dot(x.ab, b)));
      inv = Math.max(inv, Math.abs(dot(x.a2, x.b2) - dot(a, b)));
      turn = Math.max(turn, norm(sub(x.ab2, [x.turned[0] * x.det, x.turned[1] * x.det, x.turned[2] * x.det])));
    }
    expect(lag).toBeLessThan(1e-11);
    expect(perp).toBeLessThan(1e-12);
    expect(inv).toBeLessThan(1e-12);
    expect(turn).toBeLessThan(1e-12);
  });

  it('the triple product a · (b × c) is unchanged by a rotation and reversed by a mirror', () => {
    for (let i = 0; i < 200; i++) {
      const a = vec(); const b = vec(); const c = vec();
      const [y, p, r] = angles();
      for (const mirror of [false, true]) {
        const m: M3 = frame(y, p, r, mirror);
        const before = dot(a, cross(b, c));
        const after = dot(apply(m, a), cross(apply(m, b), apply(m, c)));
        expect(after - (mirror ? -1 : 1) * before).toBeCloseTo(0, 11);
      }
    }
  });

  it('the mirror claim\'s 2|a × b| is computed from the default components', () => {
    const ab = cross([2.3, 0.7, -0.4], [0.5, 1.9, 1.6]);
    const c = claims.find((x) => x.id === 'mirror-reverses-the-cross')!;
    expect(c.expect.value).toBeCloseTo(2 * norm(ab), 6);
  });
});

describe('vector-algebra: planted slips fail every claim between them', () => {
  type Vectors = typeof import('../src/plates/vector-algebra/vectors');
  const failing = async (mock: (m: Vectors) => Partial<Vectors>) => {
    vi.resetModules();
    vi.doMock('../src/plates/vector-algebra/vectors', async (orig) => { const m = await orig<Vectors>(); return { ...m, ...mock(m) }; });
    const planted = await import('./support/claims');
    const failed: string[] = [];
    for (const c of claims) {
      const f = await planted.failures(ID, c);
      if (f.length > 0) failed.push(c.id);
      for (const msg of f) expect(msg, c.id).toMatch(/" read .* expected /);
    }
    vi.doUnmock('../src/plates/vector-algebra/vectors');
    vi.resetModules();
    return failed;
  };

  it('a cross product\'s z with a plus for its minus fails the cross claims; a skewed frame fails the dot\'s', async () => {
    const bad = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] + a[1] * b[0]];
    const crossSlip = await failing((m) => ({
      read: (a: V3, b: V3, f: M3) => {
        const a2 = m.apply(f, a); const b2 = m.apply(f, b); const ab = bad(a, b);
        return { a, b, ab, a2, b2, ab2: bad(a2, b2), turned: m.apply(f, ab), det: m.det(f) };
      },
    }));
    expect(crossSlip.sort()).toEqual(claims.map((c) => c.id).filter((id) => id !== 'dot-is-invariant').sort());
    const frameSlip = await failing((m) => ({
      frame: (y: number, p: number, r: number, mirror: boolean) => {
        const f = m.frame(y, p, r, mirror);
        return [[f[0][0] + 0.01, f[0][1], f[0][2]], f[1], f[2]] as M3;
      },
    }));
    expect(frameSlip).toContain('dot-is-invariant');
    expect(new Set([...crossSlip, ...frameSlip]).size).toBe(claims.length);
  });
});
