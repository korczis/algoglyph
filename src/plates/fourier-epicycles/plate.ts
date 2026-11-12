import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { dft, evaluate, resample, rmsError, type Term } from './dft';

const SAMPLES = 256;

type Shape = [Float64Array, Float64Array];

function parametric(f: (t: number) => [number, number]): Shape {
  const xs = new Float64Array(SAMPLES);
  const ys = new Float64Array(SAMPLES);
  for (let j = 0; j < SAMPLES; j++) [xs[j], ys[j]] = f(j / SAMPLES);
  return [xs, ys];
}

function polygon(k: number, inner: number, rnd: () => number, jitter: number): Shape {
  const pts: [number, number][] = [];
  for (let i = 0; i < k * (inner > 0 ? 2 : 1); i++) {
    const r = inner > 0 && i % 2 === 1 ? inner : 1;
    const a = -Math.PI / 2 + (i * Math.PI * 2) / (k * (inner > 0 ? 2 : 1));
    const w = 1 + (rnd() - 0.5) * jitter;
    pts.push([Math.cos(a) * r * w, Math.sin(a) * r * w]);
  }
  return resample(pts, SAMPLES);
}

/** Shapes normalised to roughly [-1, 1]; y grows downwards like the canvas. */
export function shape(id: string, rnd: () => number): Shape {
  switch (id) {
    case 'square':
      return polygon(4, 0, rnd, 0);
    case 'star':
      return polygon(5, 0.42, rnd, 0);
    case 'trefoil':
      return parametric((t) => {
        const a = 2 * Math.PI * t;
        const r = 0.35 + 0.65 * Math.cos(3 * a) ** 2;
        return [r * Math.cos(a), r * Math.sin(a)];
      });
    case 'blob':
      return polygon(9, 0, rnd, 0.9);
    default: {
      // the classic heart curve, scaled into the unit box
      return parametric((t) => {
        const a = 2 * Math.PI * t;
        const x = 16 * Math.sin(a) ** 3;
        const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
        return [x / 17, -y / 17];
      });
    }
  }
}

export const fourierEpicycles: PlateCode = {
  id: 'fourier-epicycles',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 180,
  params: [
    {
      kind: 'select', key: 'shape', label: 'Curve', value: 'heart', rebuild: true,
      options: [
        { value: 'heart', label: 'Heart' },
        { value: 'square', label: 'Square' },
        { value: 'star', label: 'Star' },
        { value: 'trefoil', label: 'Trefoil' },
        { value: 'blob', label: 'Seeded blob' },
      ],
    },
    { kind: 'range', key: 'terms', label: 'Terms', min: 1, max: SAMPLES, step: 1, value: 24 },
    { kind: 'range', key: 'speed', label: 'Speed', min: 0.1, max: 4, step: 0.1, value: 1 },
    { kind: 'toggle', key: 'circles', label: 'Show circles', value: true },
    { kind: 'toggle', key: 'target', label: 'Show the target curve', value: true },
    paletteParam('ember'),
  ],
  pace: { kind: 'stream', emergent: 'the epicycles turn in continuous time: its speed scales simulated time' },
  create(p, ctx) {
    const params = ctx.params;
    let xs: Float64Array;
    let ys: Float64Array;
    let terms: Term[] = [];
    let t = 0;
    let trail: [number, number][] = [];
    let lastCount = -1;
    let error = 0;
    let size = 1;

    return {
      setup() {
        [xs, ys] = shape(str(params, 'shape'), ctx.rnd);
        terms = dft(xs, ys);
        let sum = 0;
        for (let j = 0; j < xs.length; j++) sum += xs[j] ** 2 + ys[j] ** 2;
        size = Math.sqrt(sum / xs.length);
        t = 0;
        trail = [];
        lastCount = -1;
      },
      draw() {
        const count = Math.max(1, Math.min(terms.length, Math.round(num(params, 'terms'))));
        if (count !== lastCount) {
          error = rmsError(terms, count, xs, ys);
          lastCount = count;
          trail = [];
        }
        const pal = ctx.palette();
        const scale = Math.min(ctx.width, ctx.height) * 0.36;
        const cx = ctx.width * 0.5;
        const cy = ctx.height * 0.5;
        p.background(...ctx.bg);

        if (bool(params, 'target')) {
          p.noFill();
          p.stroke(...mix(ctx.bg, ctx.fg, 0.18));
          p.strokeWeight(1);
          p.beginShape();
          for (let j = 0; j < xs.length; j++) p.vertex(cx + xs[j] * scale, cy + ys[j] * scale);
          p.endShape(p.CLOSE);
        }

        // the chain: each circle centred on the tip of the previous one
        let x = cx;
        let y = cy;
        const showCircles = bool(params, 'circles');
        for (let i = 0; i < count; i++) {
          const term = terms[i];
          const a = 2 * Math.PI * term.freq * t + term.phase;
          const r = term.amp * scale;
          const nx = x + r * Math.cos(a);
          const ny = y + r * Math.sin(a);
          if (showCircles && r > 0.4) {
            const c = mix(ctx.bg, ctx.fg, i === 0 ? 0.3 : Math.max(0.08, 0.3 - i * 0.004));
            p.noFill();
            p.stroke(...c);
            p.strokeWeight(1);
            p.circle(x, y, 2 * r);
            p.stroke(...mix(ctx.bg, ctx.fg, 0.55));
            p.line(x, y, nx, ny);
          }
          x = nx;
          y = ny;
        }
        trail.push([x, y]);
        if (trail.length > xs.length * 1.5) trail.shift();

        p.noFill();
        p.strokeWeight(2);
        for (let k = 1; k < trail.length; k++) {
          const c = ramp(pal, k / trail.length);
          p.stroke(c[0], c[1], c[2], 60 + (195 * k) / trail.length);
          p.line(trail[k - 1][0], trail[k - 1][1], trail[k][0], trail[k][1]);
        }
        p.noStroke();
        p.fill(...ctx.fg);
        p.circle(x, y, 6);

        t += (num(params, 'speed') / xs.length) * (ctx.thumbnail ? 2 : 1);
        if (t >= 1) t -= 1;

        const [ex, ey] = evaluate(terms, count, 0);
        ctx.stats([
          { label: 'terms', value: `${count} of ${terms.length}` },
          { label: 'RMS error / size', value: `${((100 * error) / size).toFixed(2)} %` },
          { label: 'largest circle', value: `f = ${terms[0].freq}, r = ${(terms[0].amp / size).toFixed(3)}` },
          { label: 'start point', value: `(${ex.toFixed(3)}, ${ey.toFixed(3)})` },
        ]);
      },
    };
  },
};

export default fourierEpicycles;
