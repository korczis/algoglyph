// Amplitude arrows: how much light a glass plate reflects, found by adding one arrow for every way
// the light can come back, tip to tail, and squaring the length of the sum. A still diagram of the
// controls; the arrows' sum is read against the Airy formula, which never sees an arrow.
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, type PlateCode, type Stat } from '../../core/plate';
import { airy, faceAmplitude, probability, reflected, roundTrip, total, transmitted, type Plate } from './arrows';

/** Points of the thickness sweep drawn in the chart. */
const SWEEP = 241;

const exp = (x: number) => x.toExponential(2);

export const amplitudeArrows: PlateCode = {
  id: 'amplitude-arrows',
  mode: '2d',
  aspect: 16 / 10,
  params: [
    { kind: 'range', key: 'd', label: 'Glass thickness (nm)', min: 0, max: 1000, step: 1, value: 330 },
    { kind: 'range', key: 'lambda', label: 'Wavelength (nm)', min: 380, max: 750, step: 1, value: 600 },
    { kind: 'range', key: 'n', label: 'Refractive index', min: 1.05, max: 2.5, step: 0.01, value: 1.5 },
    { kind: 'range', key: 'shown', label: 'Arrows drawn', min: 1, max: 12, step: 1, value: 4 },
    paletteParam('spectral'),
  ],
  pace: { kind: 'still', why: 'a diagram of the controls: the arrows are summed once when they change, and nothing in it moves' },
  create(p, ctx) {
    const params = ctx.params;
    const arrow = (x: number, y: number, dx: number, dy: number, c: [number, number, number], w: number) => {
      p.stroke(c[0], c[1], c[2]); p.strokeWeight(w);
      p.line(x, y, x + dx, y + dy);
      const len = Math.hypot(dx, dy);
      if (len < 3) return;
      const a = Math.atan2(dy, dx); const h = Math.min(9, len * 0.35);
      p.line(x + dx, y + dy, x + dx - h * Math.cos(a - 0.4), y + dy - h * Math.sin(a - 0.4));
      p.line(x + dx, y + dy, x + dx - h * Math.cos(a + 0.4), y + dy - h * Math.sin(a + 0.4));
    };
    return {
      setup() {},
      draw() {
        const plate: Plate = { n: num(params, 'n'), d: num(params, 'd'), lambda: num(params, 'lambda') };
        const shown = Math.round(num(params, 'shown'));
        const back = reflected(plate);
        const through = transmitted(plate);
        const sum = total(back);
        const R = probability(sum);
        const T = probability(total(through));
        const Ra = airy(plate);
        const two = probability(total(back, 2));
        const r = faceAmplitude(plate.n);
        const W = ctx.width; const H = ctx.height;
        const pal = ctx.palette();
        const fg = ctx.fg;
        p.background(ctx.bg[0], ctx.bg[1], ctx.bg[2]);
        p.textSize(Math.max(11, Math.min(15, W * 0.018)));

        // left: the plate and the paths light takes back out of it
        const gx = W * 0.06; const gw = W * 0.3; const gy = H * 0.42;
        const gh = Math.max(14, Math.min(H * 0.3, (plate.d / 1000) * H * 0.3));
        p.noStroke(); p.fill(...mix(ctx.bg, ramp(pal, 0.55), 0.25)); p.rect(gx, gy, gw, gh);
        p.fill(fg[0], fg[1], fg[2], 190); p.textAlign(p.LEFT, p.BOTTOM);
        p.text(`glass, n = ${plate.n.toFixed(2)}, ${plate.d.toFixed(0)} nm`, gx, gy - 6);
        for (let k = 0; k < Math.min(shown, back.length); k++) {
          const x = gx + gw * (0.12 + 0.08 * k);
          const c = ramp(pal, 0.15 + (0.7 * k) / Math.max(1, shown));
          p.stroke(c[0], c[1], c[2], 200); p.strokeWeight(1.5);
          p.line(x - 12, gy - 60, x, k === 0 ? gy : gy + gh);
          p.line(x, k === 0 ? gy : gy + gh, x + 12, gy - 60);
        }

        // right: the arrows tip to tail, and their sum
        const cx = W * 0.66; const cy = H * 0.48;
        const scale = Math.min(W * 0.28, H * 0.36) / Math.max(0.05, 2 * r);
        p.stroke(fg[0], fg[1], fg[2], 50); p.strokeWeight(1);
        p.line(cx - scale * 2 * r, cy, cx + scale * 2 * r, cy); p.line(cx, cy - scale * 2 * r, cx, cy + scale * 2 * r);
        p.noFill(); p.circle(cx, cy, 4 * scale * r);
        let x = cx; let y = cy;
        for (let k = 0; k < Math.min(shown, back.length); k++) {
          const dx = back[k].re * scale; const dy = -back[k].im * scale;
          arrow(x, y, dx, dy, ramp(pal, 0.15 + (0.7 * k) / Math.max(1, shown)), 2);
          x += dx; y += dy;
        }
        arrow(cx, cy, sum.re * scale, -sum.im * scale, [fg[0], fg[1], fg[2]], 3);
        p.noStroke(); p.fill(fg[0], fg[1], fg[2], 190); p.textAlign(p.CENTER, p.TOP);
        p.text(`the first ${Math.min(shown, back.length)} of ${back.length} arrows, and their sum`, cx, H * 0.06);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.text('the circle is twice a single face\'s arrow, 2r', cx, H - 8);

        // the reflectance over every thickness the slider allows, from the arrows and from Airy
        const sweep: [number, number][] = [];
        const sweepAiry: [number, number][] = [];
        for (let i = 0; i < SWEEP; i++) {
          const d = (1000 * i) / (SWEEP - 1);
          const q = { ...plate, d };
          sweep.push([d, probability(total(reflected(q)))]);
          sweepAiry.push([d, airy(q)]);
        }
        ctx.chart({
          title: 'Reflected probability against thickness', x: { label: 'thickness (nm)' }, y: { label: 'probability' },
          series: [{ name: 'arrows summed', points: sweep }, { name: 'Airy formula', points: sweepAiry }],
        });

        const delta = roundTrip(plate);
        const rows: Stat[] = [
          { label: 'one face\'s arrow, r = (n − 1)/(n + 1)', value: r.toFixed(6) },
          { label: 'round-trip turn of each later arrow, 4πnd/λ', value: `${(delta / Math.PI).toFixed(4)} π` },
          { label: 'reflected, the first two arrows', value: two.toFixed(6) },
          { label: 'reflected, every arrow summed', value: R.toFixed(6) },
          { label: 'Airy formula F sin²(δ/2)/(1 + F sin²(δ/2))', value: Ra.toFixed(6) },
          { label: 'arrows against Airy', value: exp(Math.abs(R - Ra)) },
          { label: 'transmitted, every arrow summed', value: T.toFixed(6) },
          { label: 'reflected + transmitted − 1', value: exp(Math.abs(R + T - 1)) },
          { label: 'thinnest plate that reflects nothing, λ/2n', value: `${(plate.lambda / (2 * plate.n)).toFixed(2)} nm` },
        ];
        ctx.stats(rows);
      },
    };
  },
};

export default amplitudeArrows;
