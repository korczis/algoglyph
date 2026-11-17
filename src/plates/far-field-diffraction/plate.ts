// Far-field diffraction (src/plates/_shared/optics/fraunhofer.ts): an aperture on a 256 × 256 grid,
// its Fraunhofer pattern by the two-dimensional FFT, and light arriving on it photon by photon.
// The zeros are measured on the transform (bracketed on its bins, bisected on the real amplitude
// along an axis) and held to the closed forms: a slit's zeros at mλ/a, a grating's principal
// maximum's half-width λ/(Nd) and its first order at λ/d, a disc's first dark ring at 1.21967λ/D,
// a rectangle's zeros at λ/w and λ/h. A reader's transmission profile replaces the aperture.
import { optionId } from '../../core/data';
import { Pacer, paceParam } from '../../core/pace';
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import { Raster } from '../../core/raster';
import {
  amplitude, disc, farField, firstZero, profile, projection, rectangle, slits, type Aperture,
} from '../_shared/optics/fraunhofer';
import { envelope } from '../_shared/optics/screen';
import { rgba } from '../_shared/two-slit/draw';

type Kind = 'slit' | 'grating' | 'circle' | 'rectangle';

/** The grid's side, in cells of the aperture plane (one cell is one micrometre). */
export const G = 256;
/** The cell pitch of the aperture plane, in micrometres. */
export const PITCH_UM = 1;
/** Rows of a slit or a grating: tall enough that the pattern's spread along y stays small. */
export const SLIT_HEIGHT = 64;
export const SAMPLES = 600;
export const PHOTONS_PER_SAMPLE = 50;
export const MAX_PER_FRAME = 30;
const when = (...values: string[]) => ({ key: 'aperture', values });

/** J₁ by its power series, for the Airy constant: converges fast below x = 6. */
function besselJ1(x: number): number {
  let term = x / 2;
  let sum = term;
  for (let m = 1; m < 60; m++) {
    term *= -(x * x) / (4 * m * (m + 1));
    sum += term;
    if (Math.abs(term) < 1e-20) break;
  }
  return sum;
}

/** The first zero of J₁ over π, 1.21967…: the Airy ring's constant, found by bisection. */
export function airyConstant(): number {
  let lo = 3;
  let hi = 4.5;
  for (let i = 0; i < 200 && hi - lo > 1e-15; i++) {
    const mid = (lo + hi) / 2;
    if (besselJ1(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2 / Math.PI;
}

export const farFieldDiffraction: PlateCode = {
  id: 'far-field-diffraction',
  mode: '2d',
  aspect: 16 / 9,
  params: [
    {
      kind: 'select', key: 'aperture', label: 'Aperture', value: 'slit', rebuild: true,
      options: [
        { value: 'slit', label: 'A single slit' },
        { value: 'grating', label: 'A grating of N slits' },
        { value: 'circle', label: 'A circular hole' },
        { value: 'rectangle', label: 'A rectangular hole' },
      ],
    },
    { kind: 'range', key: 'lambda', label: 'Wavelength λ (nm)', min: 400, max: 700, step: 10, value: 500, rebuild: true },
    { kind: 'range', key: 'a', label: 'Slit width a (µm)', min: 2, max: 128, step: 1, value: 20, rebuild: true, when: when('slit'),
      hint: 'From 2 µm, where the first zero is still inside the grid’s angles, to half the grid.' },
    { kind: 'range', key: 'ga', label: 'Width of each slit a (µm)', min: 1, max: 15, step: 1, value: 4, rebuild: true, when: when('grating'),
      hint: 'Up to 15 µm, one less than the widest pitch.' },
    { kind: 'range', key: 'N', label: 'Slits N', min: 2, max: 16, step: 1, value: 5, rebuild: true, when: when('grating') },
    { kind: 'range', key: 'd', label: 'Slit pitch d (µm)', min: 2, max: 16, step: 1, value: 12, rebuild: true, when: when('grating'),
      hint: 'Up to 16 µm, so that 16 slits fit the 256 µm grid; a pitch not wider than the slit is widened to a + 1.' },
    { kind: 'range', key: 'D', label: 'Hole diameter D (µm)', min: 4, max: 240, step: 1, value: 48, rebuild: true, when: when('circle') },
    { kind: 'range', key: 'w', label: 'Hole width w (µm)', min: 2, max: 128, step: 1, value: 24, rebuild: true, when: when('rectangle') },
    { kind: 'range', key: 'h', label: 'Hole height h (µm)', min: 2, max: 128, step: 1, value: 40, rebuild: true, when: when('rectangle') },
    paceParam(),
    paletteParam('spectral'),
  ],
  pace: { kind: 'replay', unit: 'photon batches' },
  create(p, ctx) {
    const params = ctx.params;
    let pacer = new Pacer('replay', 'photon batches', MAX_PER_FRAME);
    let kind: Kind | 'data' = 'slit';
    let ap: Aperture = slits(G, 1, 20, 0, SLIT_HEIGHT);
    let I: Float64Array = new Float64Array(G * G);
    let cdf = new Float64Array(G * G + 1);
    let counts = new Uint32Array(G * G);
    let peakCount = 1;
    let shown = 0;
    let landed = 0;
    let input = '';
    let fixed: Stat[] = [];
    let lambda = 0.5;
    let rnd = ctx.rnd;
    let apRaster: Raster | null = null;
    let hitRaster: Raster | null = null;
    // the x cut of the pattern, and the single-slit envelope drawn over it
    let cut = new Float64Array(G);
    let overlay: Float64Array | null = null;
    /** sin θ of bin k from the centre. */
    const sinOf = (k: number) => (k * lambda) / (G * PITCH_UM);
    const f9 = (v: number | null) => (v === null ? 'none within the grid' : v.toFixed(9));

    function zeroAlong(along: 'x' | 'y' | 'diagonal', from = 0, step = 0.25): number | null {
      const pr = projection(along === 'y' ? transpose(ap) : ap, along === 'diagonal' ? 'diagonal' : 'x');
      const k = firstZero((q) => amplitude(G, pr, q), from, step, G / 2);
      return k === null ? null : sinOf(k);
    }

    function measure() {
      const n = ap.t.reduce((s, v) => s + (v > 0 ? 1 : 0), 0);
      fixed = [{ label: 'aperture cells open (1 µm each)', value: `${n}` }];
      if (kind === 'slit') {
        const a = num(params, 'a');
        fixed.push(
          { label: 'first zero of the pattern, sin θ, measured', value: f9(zeroAlong('x')) },
          { label: 'first zero λ/a', value: f9(lambda / a) },
          { label: 'second zero, sin θ, measured', value: f9(zeroAlong('x', (1.5 * G) / a)) },
          { label: 'second zero 2λ/a', value: f9((2 * lambda) / a) },
        );
      } else if (kind === 'grating') {
        const N = num(params, 'N');
        const a = num(params, 'ga');
        const d = Math.max(num(params, 'd'), a + 1);
        // the first order's two neighbouring zeros lie inside the slit's first zero only when d/a > 1 + 1.5/N
        const clear = d / a > 1 + 1.5 / N;
        const unit = G / (N * d);
        const k1 = zeroAlong('x', 0, unit / 8);
        const below = zeroAlong('x', G / d - 1.5 * unit, unit / 8);
        const above = below === null ? null : zeroAlong('x', (below * G) / lambda + unit / 2, unit / 8);
        fixed.push(
          { label: 'pitch used d (µm)', value: `${d}` },
          { label: 'first zero beside the central maximum, sin θ, measured', value: f9(k1) },
          { label: 'half-width of a principal maximum λ/(Nd)', value: f9(lambda / (N * d)) },
          { label: 'first order, midway between its neighbouring zeros, sin θ, measured', value: !clear ? 'none: the first order lies past the slit’s first zero, d/a ≤ 1 + 1.5/N' : f9(below !== null && above !== null ? (below + above) / 2 : null) },
          { label: 'first order λ/d', value: f9(lambda / d) },
        );
      } else if (kind === 'circle') {
        const D = num(params, 'D');
        const Deq = 2 * Math.sqrt(n / Math.PI);
        const rx = zeroAlong('x');
        const rd = zeroAlong('diagonal');
        const A = airyConstant();
        fixed.push(
          { label: 'diameter from the disc’s area, 2√(n/π) (µm)', value: Deq.toFixed(9) },
          { label: 'first dark ring along x, sin θ, measured', value: f9(rx) },
          { label: 'first dark ring along the diagonal, sin θ, measured', value: f9(rd) },
          { label: 'first dark ring, mean of the two, sin θ', value: f9(rx !== null && rd !== null ? (rx + rd) / 2 : null) },
          { label: 'Airy ring 1.21967λ/D, D from the disc’s area', value: f9((A * lambda) / Deq) },
          { label: 'Airy ring 1.21967λ/D, D as drawn', value: f9((A * lambda) / D) },
        );
      } else if (kind === 'rectangle') {
        const w = num(params, 'w');
        const h = num(params, 'h');
        fixed.push(
          { label: 'first zero along x, sin θ, measured', value: f9(zeroAlong('x')) },
          { label: 'first zero along x, λ/w', value: f9(lambda / w) },
          { label: 'first zero along y, sin θ, measured', value: f9(zeroAlong('y')) },
          { label: 'first zero along y, λ/h', value: f9(lambda / h) },
        );
      } else {
        // a reader's profile need not be symmetric: its first minimum is read off the FFT's x cut
        let k = 1;
        while (k < G / 2 - 1 && !(cut[G / 2 + k] <= cut[G / 2 + k - 1] && cut[G / 2 + k] <= cut[G / 2 + k + 1])) k++;
        fixed.push({ label: 'first minimum of the x cut, sin θ, at the FFT’s bins', value: k < G / 2 - 1 ? sinOf(k).toFixed(9) : 'none within the grid' });
      }
    }

    function transpose(a: Aperture): Aperture {
      const t = new Float64Array(G * G);
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) t[x * G + y] = a.t[y * G + x];
      return { G, t };
    }

    function setup() {
      const raw = str(params, 'aperture');
      lambda = num(params, 'lambda') / 1000;
      shown = 0;
      landed = 0;
      rnd = ctx.rnd;
      overlay = null;
      if (optionId(raw)) {
        kind = 'data';
        const table = ctx.data?.(optionId(raw) ?? '') ?? null;
        if (table) {
          ap = profile(G, table.values[0], SLIT_HEIGHT);
          input = `your data, a profile of ${table.rows} µm`;
        } else {
          ap = slits(G, 1, 20, 0, SLIT_HEIGHT);
          input = 'your data: none attached; attach a column t of transmissions, one per µm (the default slit is shown)';
        }
      } else {
        kind = raw as Kind;
        input = `seeded: ${raw}`;
        if (kind === 'slit') ap = slits(G, 1, num(params, 'a'), 0, SLIT_HEIGHT);
        else if (kind === 'grating') {
          const a = num(params, 'ga');
          ap = slits(G, num(params, 'N'), a, Math.max(num(params, 'd'), a + 1), SLIT_HEIGHT);
        } else if (kind === 'circle') ap = disc(G, num(params, 'D'));
        else ap = rectangle(G, num(params, 'w'), num(params, 'h'));
      }
      I = farField(ap);
      let total = 0;
      cdf = new Float64Array(G * G + 1);
      for (let i = 0; i < G * G; i++) { total += I[i]; cdf[i + 1] = total; }
      const top = I[(G / 2) * G + G / 2] || 1;
      for (let x = 0; x < G; x++) cut[x] = I[(G / 2) * G + x] / top;
      if (kind === 'slit' || kind === 'grating') {
        // the single-slit envelope of the hoisted screen, at L = 1 so a screen position is sin θ
        const s = { lambda, d: 1, a: num(params, kind === 'slit' ? 'a' : 'ga'), L: 1 };
        const e0 = envelope(s, 0);
        overlay = Float64Array.from({ length: G }, (_, x) => envelope(s, sinOf(x - G / 2)) / e0);
      }
      counts = new Uint32Array(G * G);
      peakCount = 1;
      apRaster = null;
      hitRaster = null;
      measure();
      pacer = new Pacer('replay', 'photon batches', MAX_PER_FRAME);
      pacer.start(SAMPLES);
    }

    /** One photon: a cell drawn from the intensity by inverting its cumulative. */
    function photon() {
      const u = rnd() * cdf[G * G];
      let lo = 0;
      let hi = G * G;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cdf[mid] <= u) lo = mid; else hi = mid; }
      counts[lo]++;
      if (counts[lo] > peakCount) peakCount = counts[lo];
      landed++;
      return lo;
    }

    return {
      setup,
      pace: () => pacer.report(shown >= SAMPLES, params),
      draw() {
        const take = ctx.thumbnail ? MAX_PER_FRAME : pacer.take(params);
        const fresh: number[] = [];
        for (let k = 0; k < take && shown < SAMPLES; k++) {
          for (let q = 0; q < PHOTONS_PER_SAMPLE; q++) fresh.push(photon());
          shown++;
        }
        const W = ctx.width;
        const H = ctx.height;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(...ctx.bg);
        const side = Math.min(W * 0.3, H * 0.78);
        const y0 = H * 0.13;
        const xA = W * 0.03;
        const xB = xA + side + W * 0.02;
        if (!apRaster) {
          apRaster = new Raster(G, G);
          const c = ramp(pal, 0.85);
          for (let i = 0; i < G * G; i++) {
            const v = ap.t[i];
            const m = mix(ctx.bg, c, v);
            apRaster.set(i % G, Math.floor(i / G), m[0], m[1], m[2]);
          }
        }
        if (!hitRaster) {
          hitRaster = new Raster(G, G);
          hitRaster.fill(ctx.bg);
        }
        const lp = Math.log1p(peakCount);
        for (const i of fresh) {
          const m = mix(ctx.bg, ramp(pal, 0.2 + 0.7 * (Math.log1p(counts[i]) / lp)), Math.min(1, 0.35 + Math.log1p(counts[i]) / lp));
          hitRaster.set(i % G, Math.floor(i / G), m[0], m[1], m[2]);
        }
        apRaster.blit(p, false, xA, y0, side, side);
        hitRaster.blit(p, false, xB, y0, side, side);
        const g = p.drawingContext as CanvasRenderingContext2D;
        g.save();
        g.font = '11px monospace';
        g.fillStyle = rgba(fg, 0.75);
        g.fillText(`the aperture, ${G} µm across`, xA, y0 - 8);
        g.fillText(`photons in the far field: ${landed}`, xB, y0 - 8);
        // the x cut: log₁₀ of the relative intensity, the envelope dashed
        const xC = xB + side + W * 0.03;
        const wC = W - xC - W * 0.03;
        g.strokeStyle = rgba(mix(ctx.bg, fg, 0.3), 1);
        g.strokeRect(xC, y0, wC, side);
        const Y = (v: number) => y0 + side * Math.min(1, -Math.log10(Math.max(v, 1e-6)) / 6);
        const line = (vals: Float64Array, dash: boolean, col: string) => {
          g.strokeStyle = col;
          g.setLineDash(dash ? [4, 3] : []);
          g.beginPath();
          for (let x = 0; x < G; x++) { const X = xC + (x / (G - 1)) * wC; if (x === 0) g.moveTo(X, Y(vals[x])); else g.lineTo(X, Y(vals[x])); }
          g.stroke();
          g.setLineDash([]);
        };
        line(cut, false, rgba(ramp(pal, 0.8), 1));
        if (overlay) line(overlay, true, rgba(fg, 0.55));
        g.fillStyle = rgba(fg, 0.75);
        g.fillText('log₁₀ I along x (six decades); dashed: one slit’s envelope', xC, y0 - 8);
        g.fillText(`sin θ from ${sinOf(-G / 2).toFixed(3)} to ${sinOf(G / 2 - 1).toFixed(3)}`, xC, y0 + side + 16);
        g.restore();
        ctx.stats([pacer.row(params), { label: 'Input', value: input },
          { label: 'photons landed', value: `${landed} of ${SAMPLES * PHOTONS_PER_SAMPLE}` }, ...fixed]);
      },
    };
  },
};

export default farFieldDiffraction;
