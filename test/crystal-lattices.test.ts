// crystal-lattices (catalogue/entries/crystal-lattices.md) beyond the entry's claims: the shells
// against the tabled counts and distances of every lattice, the block of cells large enough, the
// claims' values against their closed forms, and a planted slip failing every claim.
import { describe, expect, it, vi } from 'vitest';
import { cellVolume, lattice, LATTICES, shells, type Lattice, type V3 } from '../src/plates/crystal-lattices/lattice';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import type { Claim } from './support/claims';

const ID = 'crystal-lattices';
const { model } = loadCatalogue(process.cwd()) as { model: { entries: { id: string; claims: Claim[] }[] } };
const claims = model.entries.find((e) => e.id === ID)!.claims;
const claim = (id: string) => claims.find((c) => c.id === id)!;

/** The first four shells, counts and squared distances in a², as the textbooks table them. */
const TABLE: Record<string, [number, number][]> = {
  sc: [[6, 1], [12, 2], [8, 3], [6, 4]],
  bcc: [[8, 3 / 4], [6, 1], [12, 2], [24, 11 / 4]],
  fcc: [[12, 1 / 2], [6, 1], [24, 3 / 2], [12, 2]],
  hcp: [[12, 1], [6, 2], [2, 8 / 3], [18, 3]],
  diamond: [[4, 3 / 16], [12, 1 / 2], [12, 11 / 16], [6, 1]],
};

describe('crystal-lattices: the shells', () => {
  it('match the tabled counts and distances of all five lattices', () => {
    for (const l of LATTICES) {
      const s = shells(l, 4);
      expect(s.map((x) => x.atoms.length), l.id).toEqual(TABLE[l.id].map((t) => t[0]));
      s.forEach((x, k) => expect(x.r * x.r, `${l.id} shell ${k + 1}`).toBeCloseTo(TABLE[l.id][k][1], 12));
    }
  });

  it('do not change when the block of cells grows from ±4 to ±7', () => {
    for (const l of LATTICES) {
      const a = shells(l, 4, 4); const b = shells(l, 4, 7);
      expect(a.map((x) => x.atoms.length)).toEqual(b.map((x) => x.atoms.length));
    }
  });

  it('every shell of the cubic lattices is symmetric under inversion through the atom, diamond\'s only every other', () => {
    for (const id of ['sc', 'bcc', 'fcc', 'diamond']) {
      shells(lattice(id), 4).forEach((sh, k) => {
        const has = (q: V3) => sh.atoms.some((p) => Math.hypot(p[0] + q[0], p[1] + q[1], p[2] + q[2]) < 1e-9);
        expect(sh.atoms.every(has), `${id} shell ${k + 1}`).toBe(!(id === 'diamond' && k % 2 === 0));
      });
    }
  });

  it('the cells hold 1, 2, 4, √2 per a³ times the basis as tabled, and the claims are the closed forms', () => {
    expect(1 / cellVolume(lattice('sc'))).toBeCloseTo(1, 14);
    expect(1 / cellVolume(lattice('bcc'))).toBeCloseTo(2, 14);
    expect(1 / cellVolume(lattice('fcc'))).toBeCloseTo(4, 14);
    expect(2 / cellVolume(lattice('hcp'))).toBeCloseTo(Math.SQRT2, 14);
    expect(claim('fcc-packing').expect.value).toBeCloseTo(Math.PI / (3 * Math.SQRT2), 9);
    expect(claim('bcc-packing').expect.value).toBeCloseTo((Math.PI * Math.sqrt(3)) / 8, 9);
    expect(claim('sc-packing').expect.value).toBeCloseTo(Math.PI / 6, 9);
    expect(claim('diamond-nearest').expect.value).toBeCloseTo(Math.sqrt(3) / 4, 9);
  });
});

describe('crystal-lattices: planted slips fail every claim between them', () => {
  type Mod = typeof import('../src/plates/crystal-lattices/lattice');
  const failing = async (slip: (l: Lattice) => Lattice) => {
    vi.resetModules();
    vi.doMock('../src/plates/crystal-lattices/lattice', async (orig) => {
      const m = await orig<Mod>();
      return { ...m, lattice: (id: string): Lattice => slip(m.lattice(id)) };
    });
    const planted = await import('./support/claims');
    const failed: string[] = [];
    for (const c of claims) {
      const f = await planted.failures(ID, c);
      if (f.length > 0) failed.push(c.id);
      for (const msg of f) expect(msg, c.id).toMatch(/" read .* expected /);
    }
    vi.doUnmock('../src/plates/crystal-lattices/lattice');
    vi.resetModules();
    return failed;
  };

  it('the first primitive vector 1 % long fails all but diamond\'s distance; a 1 % strain along x fails that', async () => {
    const longer = await failing((l) => ({ ...l, vectors: [l.vectors[0].map((x) => x * 1.01) as V3, l.vectors[1], l.vectors[2]] }));
    expect(longer.sort()).toEqual(claims.map((c) => c.id).filter((id) => id !== 'diamond-nearest').sort());
    const strain = (v: V3): V3 => [v[0] * 1.01, v[1], v[2]];
    const strained = await failing((l) => ({ ...l, vectors: [strain(l.vectors[0]), strain(l.vectors[1]), strain(l.vectors[2])], basis: l.basis.map(strain) }));
    expect(strained).toContain('diamond-nearest');
    expect(new Set([...longer, ...strained]).size).toBe(claims.length);
  });
});
