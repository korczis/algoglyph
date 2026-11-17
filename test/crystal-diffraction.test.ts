// A cubic crystal's transform (src/plates/_shared/optics/crystal.ts) beyond the entry's claims:
// the 3-D FFT against the structure factor summed directly over the basis for every reflection of
// every lattice, a random basis included; the selection rules counted against an independent count
// of their absences; the snapping of a reader's basis; and a reader's basis run by the plate.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { optionValue, parseData } from '../src/core/data';
import { GROUNDS, palette } from '../src/core/palette';
import { defaults, type Params, type PlateContext, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import {
  basis, crystal, HMAX, measured, snap, transform3, type Atom,
} from '../src/plates/_shared/optics/crystal';
import { allowed, crystalDiffraction as plate } from '../src/plates/crystal-diffraction/plate';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

/** |Σ f e^(2πi(hu + kv + lw))|², summed over the basis directly. */
function direct(atoms: Atom[], h: number, k: number, l: number): number {
  let re = 0;
  let im = 0;
  for (const a of atoms) {
    const ph = 2 * Math.PI * (h * a.u + k * a.v + l * a.w);
    re += a.f * Math.cos(ph);
    im += a.f * Math.sin(ph);
  }
  return re * re + im * im;
}

describe('crystal-diffraction: the transform', () => {
  it('reads |F(hkl)|² of every reflection as the structure factor summed over the basis', () => {
    const rnd = mulberry32(8);
    const random = snap(Array.from({ length: 5 }, () => ({ u: rnd(), v: rnd(), w: rnd(), f: 0.5 + rnd() }))).atoms;
    for (const atoms of [basis('sc'), basis('bcc'), basis('fcc'), basis('diamond'), random]) {
      const I = transform3(crystal(atoms));
      for (let h = -HMAX; h <= HMAX; h++) for (let k = -HMAX; k <= HMAX; k++) for (let l = -HMAX; l <= HMAX; l++) {
        expect(Math.abs(measured(I, h, k, l) - direct(atoms, h, k, l))).toBeLessThan(1e-9);
      }
    }
  });

  it('has the rules\' absences in the number an independent count gives', () => {
    // bcc lacks the odd sums, fcc the mixed parities; counted here by enumeration over the cube
    const count = (rule: (h: number, k: number, l: number) => boolean) => {
      let n = 0;
      for (let h = -HMAX; h <= HMAX; h++) for (let k = -HMAX; k <= HMAX; k++) for (let l = -HMAX; l <= HMAX; l++) if ((h || k || l) && !rule(h, k, l)) n++;
      return n;
    };
    expect(count((h, k, l) => allowed('bcc', h, k, l))).toBe(count((h, k, l) => Math.abs(h + k + l) % 2 === 0));
    expect(count((h, k, l) => allowed('fcc', h, k, l))).toBe(count((h, k, l) => Math.abs(h % 2) === Math.abs(k % 2) && Math.abs(k % 2) === Math.abs(l % 2)));
    expect(count((h, k, l) => allowed('sc', h, k, l))).toBe(0);
  });

  it('snaps a basis to eighths of the cell and counts the atoms it moved', () => {
    const s = snap([{ u: 0.25, v: 0.5, w: 0, f: 1 }, { u: 0.3, v: 1, w: -0.125, f: 2 }]);
    expect(s.atoms[1]).toEqual({ u: 0.25, v: 0, w: 0.875, f: 2 });
    expect(s.moved).toBe(1);
  });
});

describe('crystal-diffraction: a reader\'s basis', () => {
  const decl = ENTRIES.find((e) => e.id === 'crystal-diffraction')!.data[0];
  it('transforms the reader\'s basis: a CsCl-like pair of unequal atoms keeps the bcc reflections it would lose', () => {
    const r = parseData(decl, 'u,v,w,f\n0,0,0,2\n0.5,0.5,0.5,1');
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const params: Params = { ...defaults(plate as never), pace: 4096, lattice: optionValue('basis') };
    let rows: Stat[] = [];
    const ctx: PlateContext = {
      width: 800, height: 450, params, seed: 1, rnd: mulberry32(1), theme: 'dark', bg: GROUNDS.dark.bg, fg: GROUNDS.dark.fg,
      thumbnail: false, palette: () => palette('spectral'), stats(s) { rows = s; }, chart() {}, data: () => r.table,
    };
    const sim = plate.create(p5Stub(), ctx);
    sim.setup();
    for (let i = 0; i < 2000 && !sim.pace!().done; i++) sim.draw();
    sim.draw();
    const value = (label: string) => rows.find((s) => s.label === label)?.value;
    expect(value('Input')).toBe('your data, 2 atoms in the cell');
    // (2 − 1)² = 1 at odd sums, (2 + 1)² = 9 at even ones: nothing is absent
    expect(value('|F(111)|², measured on the transform')).toBe((1).toFixed(9));
    expect(value('|F(200)|², measured on the transform')).toBe((9).toFixed(9));
    expect(value('reflections absent, |F|² below 1e−9 of one atom’s')).toBe('0');
  });
});
