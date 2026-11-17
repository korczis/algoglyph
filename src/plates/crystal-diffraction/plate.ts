// Crystal diffraction (src/plates/_shared/optics/crystal.ts): a cubic crystal of point scatterers,
// its three-dimensional transform, the reflections that survive and the powder lines they make.
// Which reflections a body-centred, face-centred or diamond crystal lacks is read off the
// transform and held to the selection rules; a diffractometer scan in 2θ is the paced run. A
// reader's own basis replaces the lattice.
import { optionId } from '../../core/data';
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import {
  basis, crystal, HMAX, measured, powder, reflections, snap, transform3, type Atom, type Lattice,
  type PowderLine, type Reflection,
} from '../_shared/optics/crystal';
import { rgba } from '../_shared/two-slit/draw';

export const SAMPLES = 600;
export const MAX_PER_FRAME = 30;
/** A reflection whose measured |F|² is below this is absent: round-off is some 1e−28 of the cell's. */
export const ABSENT = 1e-9;
/** The powder lines measured: below (HMAX + 1)², no reflection needs an index above HMAX. */
export const NMAX = (HMAX + 1) ** 2 - 1;

/** The selection rule of each lattice: whether (h, k, l) reflects. */
export function allowed(lattice: Lattice, h: number, k: number, l: number): boolean {
  const even = (x: number) => ((x % 2) + 2) % 2 === 0;
  const same = even(h) === even(k) && even(k) === even(l);
  if (lattice === 'sc') return true;
  if (lattice === 'bcc') return even(h + k + l);
  if (lattice === 'fcc') return same;
  return same && (!even(h) || (((h + k + l) % 4) + 4) % 4 === 0);
}

/** |F|² by the rule: the basis atoms in phase, n² for n atoms, or the diamond's 32 for odd indices. */
export function ruleF2(lattice: Lattice, h: number, k: number, l: number): number {
  if (!allowed(lattice, h, k, l)) return 0;
  if (lattice === 'sc') return 1;
  if (lattice === 'bcc') return 4;
  if (lattice === 'fcc') return 16;
  return h % 2 !== 0 ? 32 : 64;
}

export const crystalDiffraction: PlateCode = {
  id: 'crystal-diffraction',
  mode: '2d',
  aspect: 16 / 9,
  params: [
    {
      kind: 'select', key: 'lattice', label: 'Crystal', value: 'bcc', rebuild: true,
      options: [
        { value: 'sc', label: 'Simple cubic' },
        { value: 'bcc', label: 'Body-centred cubic' },
        { value: 'fcc', label: 'Face-centred cubic' },
        { value: 'diamond', label: 'Diamond' },
      ],
    },
    { kind: 'range', key: 'a', label: 'Cube edge a (Å)', min: 2, max: 8, step: 0.01, value: 2.87, rebuild: true },
    { kind: 'range', key: 'lambda', label: 'X-ray wavelength λ (Å)', min: 0.5, max: 2.5, step: 0.01, value: 1.54, rebuild: true,
      hint: 'Cu Kα is 1.54 Å; a line with λ√(h² + k² + l²) > 2a is beyond any angle.' },
    { kind: 'range', key: 'layer', label: 'Layer of the reciprocal lattice shown, l', min: 0, max: HMAX, step: 1, value: 0, cosmetic: true },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'scan steps' },
  create(p, ctx) {
    const params = ctx.params;
    let pacer = new Pacer('replay', 'scan steps', MAX_PER_FRAME);
    let lattice: Lattice | 'data' = 'bcc';
    let atoms: Atom[] = [];
    let refl: Reflection[] = [];
    let lines: PowderLine[] = [];
    let shown = 0;
    let input = '';
    let fixed: Stat[] = [];
    let lambda = 1.54;
    let a = 3.3;
    let top = 1;
    let yaw = 0.5;
    let pitch = 0.3;
    let grab: [number, number] | null = null;
    /** 2θ of a line, in degrees, or null when the wavelength cannot reach it. */
    const twoTheta = (n: number) => { const s = (lambda * Math.sqrt(n)) / (2 * a); return s <= 1 ? (360 / Math.PI) * Math.asin(s) : null; };

    function setup() {
      const raw = str(params, 'lattice');
      lambda = num(params, 'lambda');
      a = num(params, 'a');
      shown = 0;
      if (optionId(raw)) {
        lattice = 'data';
        const table = ctx.data?.(optionId(raw) ?? '') ?? null;
        if (table) {
          const s = snap(Array.from({ length: table.rows }, (_, i) => ({ u: table.values[0][i], v: table.values[1][i], w: table.values[2][i], f: table.values[3][i] })));
          atoms = s.atoms;
          input = `your data, ${table.rows} atoms in the cell${s.moved ? `, ${s.moved} snapped to the nearest eighth of the cell` : ''}`;
        } else {
          atoms = basis('sc');
          input = 'your data: none attached; attach a table of u, v, w, f (the simple cubic cell is shown)';
        }
      } else {
        lattice = raw as Lattice;
        atoms = basis(lattice);
        input = `seeded: ${raw}, ${atoms.length} atoms in the cell`;
      }
      const I = transform3(crystal(atoms));
      refl = reflections(I);
      lines = powder(refl, ABSENT).filter((l) => l.n <= NMAX);
      top = Math.max(1e-12, ...refl.map((r) => r.F2));
      const absent = refl.filter((r) => r.F2 <= ABSENT).length;
      fixed = [
        { label: `reflections measured, |h|, |k|, |l| ≤ ${HMAX}`, value: `${refl.length}` },
        { label: 'reflections absent, |F|² below 1e−9 of one atom’s', value: `${absent}` },
        { label: `powder lines present, h² + k² + l² up to ${NMAX}`, value: lines.map((l) => l.n).join(', ') || 'none' },
      ];
      const lt = lattice;
      if (lt !== 'data') {
        const wrong = refl.filter((r) => (r.F2 > ABSENT) !== allowed(lt, r.h, r.k, r.l)).length;
        fixed.push({ label: 'reflections disagreeing with the selection rule, counted', value: `${wrong}` });
      }
      for (const [h, k, l] of [[1, 1, 1], [2, 0, 0], [2, 2, 0]]) {
        fixed.push({ label: `|F(${h}${k}${l})|², measured on the transform`, value: measured(I, h, k, l).toFixed(9) });
        if (lt !== 'data') fixed.push({ label: `|F(${h}${k}${l})|² by the rule`, value: ruleF2(lt, h, k, l).toFixed(9) });
      }
      const first = lines[0];
      const tt = first ? twoTheta(first.n) : null;
      fixed.push({ label: 'Bragg angle of the first line, 2θ = 2 asin(λ√(h² + k² + l²)/2a) (degrees)', value: tt === null ? 'none: beyond the wavelength’s reach' : tt.toFixed(6) });
      pacer = new Pacer('replay', 'scan steps', MAX_PER_FRAME);
      pacer.start(SAMPLES);
    }

    function project(x: number, y: number, z: number, cx: number, cy: number, sc: number): [number, number] {
      const xr = Math.cos(yaw) * x + Math.sin(yaw) * y;
      const d = -Math.sin(yaw) * x + Math.cos(yaw) * y;
      return [cx + sc * xr, cy - sc * (Math.cos(pitch) * z - Math.sin(pitch) * d)];
    }

    return {
      setup,
      pace: () => pacer.report(shown >= SAMPLES, params),
      pressed(x, y) { grab = [x, y]; },
      dragged(x, y) {
        if (!grab) { grab = [x, y]; return; }
        yaw += (x - grab[0]) * 0.01;
        pitch = Math.max(-1.4, Math.min(1.4, pitch + (y - grab[1]) * 0.01));
        grab = [x, y];
      },
      reset() { yaw = 0.5; pitch = 0.3; grab = null; },
      draw() {
        const take = ctx.thumbnail ? MAX_PER_FRAME : pacer.take(params);
        shown = Math.min(SAMPLES, shown + take);
        const scan = (180 * shown) / SAMPLES;
        const W = ctx.width;
        const H = ctx.height;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        const g = p.drawingContext as CanvasRenderingContext2D;
        g.save();
        g.font = '11px monospace';
        g.fillStyle = rgba(fg, 0.75);
        // left: the cubic cell and its atoms (each atom with its images on the cell's faces)
        const cx = W * 0.15;
        const cy = H * 0.55;
        const sc = Math.min(W * 0.12, H * 0.3);
        const P = (x: number, y: number, z: number) => project(x - 0.5, y - 0.5, z - 0.5, cx, cy, sc);
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.4), 1);
        g.beginPath();
        for (let i = 0; i < 8; i++) for (let ax = 0; ax < 3; ax++) {
          const j = i ^ (1 << ax);
          if (j < i) continue;
          const A = P(i & 1, (i >> 1) & 1, (i >> 2) & 1);
          const B = P(j & 1, (j >> 1) & 1, (j >> 2) & 1);
          g.moveTo(A[0], A[1]);
          g.lineTo(B[0], B[1]);
        }
        g.stroke();
        const fmax = Math.max(1e-12, ...atoms.map((t) => Math.abs(t.f)));
        g.fillStyle = rgba(ramp(pal, 0.8), 1);
        for (const t of atoms) {
          for (let m = 0; m < 8; m++) {
            const x = t.u + (m & 1);
            const y = t.v + ((m >> 1) & 1);
            const z = t.w + ((m >> 2) & 1);
            if (x > 1 + 1e-9 || y > 1 + 1e-9 || z > 1 + 1e-9) continue;
            const [X, Y] = P(x, y, z);
            g.beginPath();
            g.arc(X, Y, 2 + 4 * Math.sqrt(Math.abs(t.f) / fmax), 0, 2 * Math.PI);
            g.fill();
          }
        }
        g.fillStyle = rgba(fg, 0.75);
        g.fillText('the cubic cell (drag to turn)', W * 0.02, H * 0.08);
        // middle: the layer l of the reciprocal lattice, spots by measured |F|², absent ones hollow
        const layer = Math.round(num(params, 'layer'));
        const mx = W * 0.31;
        const side = Math.min(W * 0.3, H * 0.76);
        const my = H * 0.13;
        const cell = side / (2 * HMAX + 1);
        for (const r of refl) {
          if (r.l !== layer) continue;
          const X = mx + (r.h + HMAX + 0.5) * cell;
          const Y = my + (HMAX - r.k + 0.5) * cell;
          g.beginPath();
          if (r.F2 > ABSENT) {
            g.fillStyle = rgba(ramp(pal, 0.25 + 0.6 * (r.F2 / top)), 1);
            g.arc(X, Y, 2 + 0.4 * cell * Math.sqrt(r.F2 / top), 0, 2 * Math.PI);
            g.fill();
          } else {
            g.strokeStyle = rgba(fg, 0.35);
            g.arc(X, Y, 2.5, 0, 2 * Math.PI);
            g.stroke();
          }
        }
        g.fillStyle = rgba(fg, 0.75);
        g.fillText(`(h, k, ${layer}); hollow: absent`, mx, my - 8);
        // right: the powder diffractogram, scanned in 2θ
        const px = mx + side + W * 0.03;
        const pw = W - px - W * 0.03;
        const ph = side;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
        g.strokeRect(px, my, pw, ph);
        const lmax = Math.max(1e-12, ...lines.map((l) => l.F2));
        g.strokeStyle = rgba(ramp(pal, 0.75), 1);
        g.lineWidth = 2;
        g.beginPath();
        for (const l of lines) {
          const tt = twoTheta(l.n);
          if (tt === null || tt > scan) continue;
          const X = px + (tt / 180) * pw;
          g.moveTo(X, my + ph);
          g.lineTo(X, my + ph - (l.F2 / lmax) * ph * 0.9);
        }
        g.stroke();
        g.lineWidth = 1;
        g.strokeStyle = rgba(fg, 0.5);
        g.beginPath();
        g.moveTo(px + (scan / 180) * pw, my);
        g.lineTo(px + (scan / 180) * pw, my + ph);
        g.stroke();
        g.fillStyle = rgba(fg, 0.75);
        g.fillText('powder lines, 2θ 0°–180°', px, my - 8);
        g.restore();
        ctx.stats([pacer.row(params), { label: 'Input', value: input }, { label: 'scan 2θ (degrees)', value: scan.toFixed(1) }, ...fixed]);
      },
    };
  },
};

export default crystalDiffraction;
