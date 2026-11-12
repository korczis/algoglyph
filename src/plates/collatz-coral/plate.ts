import { paletteParam, ramp } from '../../core/palette';
import { num, type PlateCode } from '../../core/plate';

/** The Collatz orbit of n down to 1, inclusive. */
export function collatz(n: number): number[] {
  const out = [n];
  while (n !== 1) {
    n = n % 2 === 0 ? n / 2 : 3 * n + 1;
    out.push(n);
  }
  return out;
}

export const collatzCoral: PlateCode = {
  id: 'collatz-coral',
  mode: '2d',
  aspect: 4 / 3,
  thumbnailFrames: 60,
  params: [
    { kind: 'range', key: 'count', label: 'Orbits', min: 500, max: 20000, step: 500, value: 6000,
      rebuild: true },
    {
      kind: 'select', key: 'range', label: 'Start values up to', value: '100000', rebuild: true,
      options: [
        { value: '10000', label: '10 000' },
        { value: '100000', label: '100 000' },
        { value: '1000000', label: '1 000 000' },
      ],
    },
    { kind: 'range', key: 'even', label: 'Even turn (rad)', min: 0.02, max: 0.4, step: 0.005,
      value: 0.15, rebuild: true },
    { kind: 'range', key: 'odd', label: 'Odd turn (rad)', min: 0.02, max: 0.6, step: 0.005,
      value: 0.3, rebuild: true },
    { kind: 'range', key: 'step', label: 'Step length (px)', min: 1, max: 14, step: 0.5, value: 5,
      rebuild: true },
    paletteParam('ember'),
  ],
  pace: { kind: 'still', why: 'draws every orbit once, progressively, into one still picture' },
  create(p, ctx) {
    const params = ctx.params;
    let starts: number[] = [];
    let index = 0;
    let longest = { n: 1, len: 1 };
    let maxLen = 1;
    let steps = 0;

    return {
      setup() {
        const count = num(params, 'count');
        const range = num(params, 'range');
        starts = Array.from({ length: count }, () => 1 + Math.floor(ctx.rnd() * range));
        // the longest orbit in the sample sets the colour scale before anything is drawn
        maxLen = 1;
        for (const n of starts) {
          let m = n;
          let len = 1;
          while (m !== 1) {
            m = m % 2 === 0 ? m / 2 : 3 * m + 1;
            len++;
          }
          if (len > maxLen) maxLen = len;
        }
        index = 0;
        steps = 0;
        longest = { n: 1, len: 1 };
        p.background(...ctx.bg);
      },
      draw() {
        const pal = ctx.palette();
        const even = num(params, 'even');
        const odd = num(params, 'odd');
        const len = num(params, 'step');
        const batch = ctx.thumbnail ? Math.ceil(starts.length / 50) : 120;
        p.noFill();
        p.strokeWeight(ctx.thumbnail ? 0.8 : 1);
        for (let k = 0; k < batch && index < starts.length; k++, index++) {
          const orbit = collatz(starts[index]).reverse();
          if (orbit.length > longest.len) longest = { n: starts[index], len: orbit.length };
          const c = ramp(pal, Math.pow(orbit.length / maxLen, 0.8));
          p.stroke(c[0], c[1], c[2], 34);
          let x = ctx.width * 0.5;
          let y = ctx.height * 0.98;
          let a = -Math.PI / 2;
          const scaleLen = len * (ctx.width / 1000);
          p.beginShape();
          p.vertex(x, y);
          for (let i = 1; i < orbit.length; i++) {
            a += orbit[i] % 2 === 0 ? even : -odd;
            x += Math.cos(a) * scaleLen;
            y += Math.sin(a) * scaleLen;
            p.vertex(x, y);
          }
          p.endShape();
          steps += orbit.length - 1;
        }
        ctx.stats([
          { label: 'orbits drawn', value: `${index.toLocaleString('en')} / ${starts.length.toLocaleString('en')}` },
          { label: 'steps drawn', value: steps.toLocaleString('en') },
          { label: 'longest orbit', value: `${longest.n.toLocaleString('en')} → ${longest.len - 1} steps` },
        ]);
      },
    };
  },
};

export default collatzCoral;
