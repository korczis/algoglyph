// Spectra: two close lines of a lamp, each as wide as its atoms' motion and its decay make it, and
// what a grating spectrometer records of them. A still diagram of the controls; every readout is
// checked against a closed form that never sees the computed profiles.
import { paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode, type Stat } from '../../core/plate';
import {
  dopplerSigma, instrument, lamp, LAMPS, measuredFwhm, oliveroFwhm, profile, recorded, unbroadened, voigt, voigtPeak,
} from './lines';

/** Wavelengths at which the recording is computed and drawn. */
const SAMPLES = 240;
/** Points of each line's own profile. */
const PROFILE = 161;

const exp = (x: number) => x.toExponential(2);
const FWHM_PER_SIGMA = 2 * Math.sqrt(2 * Math.LN2);

interface Picture {
  key: string;
  at: Float64Array; rec: Float64Array; ideal: Float64Array;
  xs: Float64Array; shapes: Float64Array[]; rows: Stat[];
  points: [number, number][]; idealPoints: [number, number][];
}

export const spectra: PlateCode = {
  id: 'spectra',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    { kind: 'select', key: 'lamp', label: 'Lamp', value: 'sodium', options: LAMPS.map((l) => ({ value: l.id, label: l.label })) },
    { kind: 'range', key: 'T', label: 'Temperature of the vapour (K)', min: 300, max: 3000, step: 10, value: 500 },
    { kind: 'range', key: 'width', label: 'Lorentzian width, decay and collisions (FWHM, pm)', min: 0, max: 20, step: 0.01, value: 1 },
    { kind: 'range', key: 'grooves', label: 'Grooves lit, N', min: 100, max: 3000, step: 1, value: 1200, log: true },
    { kind: 'range', key: 'order', label: 'Order, m', min: 1, max: 3, step: 1, value: 1 },
    paletteParam('spectral'),
  ],
  pace: { kind: 'still', why: 'a diagram of the controls: the lines and their recording are computed once when a control changes, and nothing in it moves' },
  create(p, ctx) {
    const params = ctx.params;
    let pic: Picture | null = null;

    const compute = (key: string): Picture => {
      const L = lamp(str(params, 'lamp'));
      const T = num(params, 'T');
      const gamma = num(params, 'width') / 2;
      const g = { grooves: Math.round(num(params, 'grooves')), order: Math.round(num(params, 'order')) };
      const [a, b] = L.lines;
      const sep = b.lambda - a.lambda;
      const mean = (a.lambda + b.lambda) / 2;
      const sigmas = L.lines.map((l) => dopplerSigma(l.lambda, T, L.mass));
      const s0 = sigmas[0];

      // the recording, from a little left of the first line to as far right of the second
      const res = mean / (g.order * g.grooves);
      const margin = Math.max(0.8 * sep, 4 * res);
      const at = new Float64Array(SAMPLES);
      for (let i = 0; i < SAMPLES; i++) at[i] = a.lambda - margin + ((sep + 2 * margin) * i) / (SAMPLES - 1);
      const rec = recorded(at, L.lines, sigmas, gamma, g);
      const ideal = unbroadened(at, L.lines, g);

      // each line's own shape, over six of its widths either side
      const fwhm = measuredFwhm(s0, gamma);
      const xs = new Float64Array(PROFILE);
      for (let i = 0; i < PROFILE; i++) xs[i] = -6 * fwhm + (12 * fwhm * i) / (PROFILE - 1);
      const shapes = sigmas.map((s) => profile(xs, s, gamma));

      // the readouts
      const fG = FWHM_PER_SIGMA * s0;
      const doppler = measuredFwhm(s0, 0);
      const closedDoppler = a.lambda * Math.sqrt((8 * Math.LN2 * 1.380649e-23 * T) / (L.mass * 1.6605390666e-27 * 299792458 ** 2));
      const peak = voigt(0, s0, gamma);
      const peakForm = voigtPeak(s0, gamma);
      const ol = oliveroFwhm(fG, 2 * gamma);
      const mid = recorded(new Float64Array([mean, a.lambda]), L.lines, sigmas, gamma, g);
      const ratio = mid[0] / mid[1];
      const idealRatio = ((a.weight + b.weight) * instrument(sep / 2, mean, g)) / (a.weight + b.weight * instrument(sep, mean, g));
      const rows: Stat[] = [
        { label: 'resolving power mN', value: String(g.order * g.grooves) },
        { label: 'the pair needs λ̄/Δλ (Rayleigh)', value: (mean / sep).toFixed(1) },
        { label: 'Doppler width, measured on the profile', value: `${doppler.toFixed(5)} pm` },
        { label: 'Doppler width, λ√(8 ln 2 · kT/Mc²)', value: `${closedDoppler.toFixed(5)} pm` },
        { label: 'line width (FWHM), measured on the profile', value: `${fwhm.toFixed(5)} pm` },
        { label: 'width against Olivero–Longbothum', value: exp(Math.abs(fwhm - ol) / fwhm) },
        { label: 'peak against erfcx(γ/σ√2)/(σ√2π)', value: exp(Math.abs(peak - peakForm) / peakForm) },
        { label: 'recorded at the midpoint, over its value at the first line', value: ratio.toFixed(6) },
        { label: 'the same for lines of no width, closed form', value: idealRatio.toFixed(6) },
        { label: 'the instrument\'s width λ̄/mN', value: `${res.toFixed(2)} pm` },
      ];
      const points: [number, number][] = [];
      const idealPoints: [number, number][] = [];
      for (let i = 0; i < SAMPLES; i++) {
        points.push([at[i] / 1000, rec[i]]);
        idealPoints.push([at[i] / 1000, ideal[i]]);
      }
      return { key, at, rec, ideal, xs, shapes, rows, points, idealPoints };
    };

    return {
      setup() {},
      draw() {
        const key = ['lamp', 'T', 'width', 'grooves', 'order'].map((k) => String(params[k])).join('|');
        if (!pic || pic.key !== key) pic = compute(key);
        const W = ctx.width; const H = ctx.height;
        const pal = ctx.palette();
        const fg = ctx.fg;
        const L = lamp(str(params, 'lamp'));
        p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
        p.textSize(Math.max(11, Math.min(15, W * 0.018)));

        // top: each line as the atoms send it, its own scale
        const top = H * 0.08; const th = H * 0.3; const pw = W * 0.4;
        for (let li = 0; li < pic.shapes.length; li++) {
          const x0 = W * 0.06 + li * W * 0.48;
          const shape = pic.shapes[li];
          let max = 0;
          for (let i = 0; i < shape.length; i++) max = Math.max(max, shape[i]);
          const c = ramp(pal, 0.25 + 0.5 * li);
          p.stroke(fg[0], fg[1], fg[2], 60); p.strokeWeight(1);
          p.line(x0, top + th, x0 + pw, top + th);
          p.stroke(c[0], c[1], c[2]); p.strokeWeight(2); p.noFill();
          p.beginShape();
          for (let i = 0; i < shape.length; i++) p.vertex(x0 + (pw * i) / (shape.length - 1), top + th - (th * shape[i]) / max);
          p.endShape();
          p.noStroke(); p.fill(fg[0], fg[1], fg[2], 190); p.textAlign(p.LEFT, p.TOP);
          p.text(`${(L.lines[li].lambda / 1000).toFixed(4)} nm, ±${pic.xs[pic.xs.length - 1].toFixed(1)} pm shown`, x0, top + th + 4);
        }

        // bottom: what the spectrometer records across both lines, and the same for lines of no width
        const by = H * 0.52; const bh = H * 0.4; const bx = W * 0.06; const bw = W * 0.88;
        let max = 0;
        for (let i = 0; i < pic.rec.length; i++) max = Math.max(max, pic.rec[i], pic.ideal[i]);
        p.stroke(fg[0], fg[1], fg[2], 60); p.strokeWeight(1);
        p.line(bx, by + bh, bx + bw, by + bh);
        p.stroke(fg[0], fg[1], fg[2], 110); p.strokeWeight(1); p.noFill();
        p.beginShape();
        for (let i = 0; i < pic.ideal.length; i++) p.vertex(bx + (bw * i) / (pic.ideal.length - 1), by + bh - (bh * pic.ideal[i]) / max);
        p.endShape();
        const c = ramp(pal, 0.6);
        p.stroke(c[0], c[1], c[2]); p.strokeWeight(2.5);
        p.beginShape();
        for (let i = 0; i < pic.rec.length; i++) p.vertex(bx + (bw * i) / (pic.rec.length - 1), by + bh - (bh * pic.rec[i]) / max);
        p.endShape();
        p.noStroke(); p.fill(fg[0], fg[1], fg[2], 190); p.textAlign(p.LEFT, p.BOTTOM);
        p.text('recorded by the spectrometer (thick), and for lines of no width (thin)', bx, by - 4);

        ctx.chart({
          title: 'Recorded spectrum across the pair', x: { label: 'wavelength (nm)' }, y: { label: 'recorded, a line of no width peaks at its strength' },
          series: [{ name: 'recorded', points: pic.points }, { name: 'lines of no width', points: pic.idealPoints }],
        });
        ctx.stats(pic.rows);
      },
    };
  },
};

export default spectra;
