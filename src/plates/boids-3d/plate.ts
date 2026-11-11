import { mix, paletteParam, ramp, type RGB } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { DEFAULT_RULES, Flock, Grid, meanNearest, polarisation, type Rules, type V3 }
  from './flock';

const HALF: V3 = [1.5, 0.9, 1];
const HISTORY = 16;
const THUMB_FRAMES = 240;
const BIRD = 0.026;

export const boidsMurmuration: PlateCode = {
  id: 'boids-3d',
  mode: 'webgl',
  aspect: 16 / 10,
  thumbnailFrames: THUMB_FRAMES,
  params: [
    { kind: 'range', key: 'n', label: 'Boids', min: 100, max: 1500, step: 50, value: 800,
      rebuild: true },
    { kind: 'range', key: 'separation', label: 'Separation', min: 0, max: 3, step: 0.05,
      value: DEFAULT_RULES.separation },
    { kind: 'range', key: 'alignment', label: 'Alignment', min: 0, max: 3, step: 0.05,
      value: DEFAULT_RULES.alignment },
    { kind: 'range', key: 'cohesion', label: 'Cohesion', min: 0, max: 3, step: 0.05,
      value: DEFAULT_RULES.cohesion },
    { kind: 'range', key: 'radius', label: 'Perception radius', min: 0.06, max: 0.4, step: 0.01,
      value: DEFAULT_RULES.radius },
    { kind: 'range', key: 'speed', label: 'Max speed', min: 0.2, max: 1.5, step: 0.05,
      value: DEFAULT_RULES.maxSpeed },
    { kind: 'range', key: 'trail', label: 'Trail length', min: 0, max: HISTORY, step: 1,
      value: 9 },
    {
      kind: 'select', key: 'colour', label: 'Colour by', value: 'density',
      options: [
        { value: 'density', label: 'Local density' },
        { value: 'heading', label: 'Heading' },
      ],
    },
    { kind: 'toggle', key: 'spin', label: 'Auto-rotate camera', value: true },
    paletteParam('ember'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let flock = new Flock(1, HALF);
    let hist = new Float32Array(0);
    let colours: RGB[] = [];
    const grid = new Grid();
    let head = 0;
    let filled = 0;
    let angle = 0;
    let frames = 0;

    const rules = (): Rules => ({
      ...DEFAULT_RULES,
      separation: num(params, 'separation'),
      alignment: num(params, 'alignment'),
      cohesion: num(params, 'cohesion'),
      radius: num(params, 'radius'),
      maxSpeed: num(params, 'speed'),
    });

    const record = () => {
      head = (head + 1) % HISTORY;
      const { n, pos } = flock;
      for (let i = 0; i < n; i++) {
        const o = (i * HISTORY + head) * 3;
        hist[o] = pos[i * 3];
        hist[o + 1] = pos[i * 3 + 1];
        hist[o + 2] = pos[i * 3 + 2];
      }
      filled = Math.min(HISTORY, filled + 1);
    };

    const frame = () => {
      p.stroke(...mix(ctx.bg, ctx.fg, 0.14));
      p.strokeWeight(1);
      const [x, y, z] = HALF;
      p.beginShape(p.LINES);
      for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        p.vertex(-x, a * y, b * z);
        p.vertex(x, a * y, b * z);
        p.vertex(a * x, -y, b * z);
        p.vertex(a * x, y, b * z);
        p.vertex(a * x, b * y, -z);
        p.vertex(a * x, b * y, z);
      }
      p.endShape();
    };

    return {
      setup() {
        const n = num(params, 'n');
        flock = new Flock(n, HALF);
        flock.scatter(ctx.rnd, rules());
        hist = new Float32Array(n * HISTORY * 3);
        colours = Array.from({ length: n }, (): RGB => [0, 0, 0]);
        head = 0;
        filled = 0;
        frames = 0;
        angle = ctx.rnd() * Math.PI * 2;
        record();
      },
      draw() {
        const r = rules();
        flock.step(r);
        record();
        frames++;
        if (bool(params, 'spin')) angle += 0.0018;
        // a thumbnail keeps only its last frame, so earlier ones need the step, not the picture
        if (ctx.thumbnail && frames < THUMB_FRAMES) return;

        const pal = ctx.palette();
        const { n, pos, vel, crowd } = flock;
        const byHeading = str(params, 'colour') === 'heading';
        for (let i = 0; i < n; i++) {
          const t = byHeading
            ? Math.atan2(vel[i * 3 + 2], vel[i * 3]) / (2 * Math.PI) + 0.5
            : 0.4 + 0.6 * Math.min(1, crowd[i] / 16);
          // lift every bird a little towards the ink so the palette's dark end stays visible
          colours[i] = mix(ramp(pal, t, byHeading), ctx.fg, 0.14);
        }

        p.background(...ctx.bg);
        if (!ctx.thumbnail) p.orbitControl(1, 1, 0.3);
        p.rotateX(-0.32);
        p.rotateY(angle);
        p.scale(Math.min(ctx.width / 4.4, ctx.height / 2.7));
        frame();

        const len = Math.min(num(params, 'trail'), filled - 1);
        if (len > 0) {
          p.strokeWeight(ctx.thumbnail ? 0.8 : 1);
          p.beginShape(p.LINES);
          for (let i = 0; i < n; i++) {
            const c = colours[i];
            const base = i * HISTORY;
            for (let a = 0; a < len; a++) {
              const s0 = (base + ((head - a + HISTORY) % HISTORY)) * 3;
              const s1 = (base + ((head - a - 1 + HISTORY) % HISTORY)) * 3;
              const fade = 1 - a / len;
              p.stroke(c[0], c[1], c[2], 150 * fade * fade);
              p.vertex(hist[s0], hist[s0 + 1], hist[s0 + 2]);
              p.vertex(hist[s1], hist[s1 + 1], hist[s1 + 2]);
            }
          }
          p.endShape();
        }

        // each bird a small dart along its velocity, wings level with the horizon
        p.noStroke();
        p.beginShape(p.TRIANGLES);
        for (let i = 0; i < n; i++) {
          const vx = vel[i * 3];
          const vy = vel[i * 3 + 1];
          const vz = vel[i * 3 + 2];
          const s = Math.hypot(vx, vy, vz) || 1;
          const ux = vx / s;
          const uy = vy / s;
          const uz = vz / s;
          // side = u × up, up = (0, 1, 0)
          let wx = -uz;
          let wz = ux;
          const wl = Math.hypot(wx, wz);
          if (wl < 1e-6) {
            wx = 1;
            wz = 0;
          } else {
            wx /= wl;
            wz /= wl;
          }
          const x = pos[i * 3];
          const y = pos[i * 3 + 1];
          const z = pos[i * 3 + 2];
          const c = colours[i];
          p.fill(c[0], c[1], c[2], 235);
          p.vertex(x + ux * BIRD, y + uy * BIRD, z + uz * BIRD);
          p.vertex(x - ux * BIRD * 0.7 + wx * BIRD * 0.6, y - uy * BIRD * 0.7,
            z - uz * BIRD * 0.7 + wz * BIRD * 0.6);
          p.vertex(x - ux * BIRD * 0.7 - wx * BIRD * 0.6, y - uy * BIRD * 0.7,
            z - uz * BIRD * 0.7 - wz * BIRD * 0.6);
        }
        p.endShape();

        if (ctx.thumbnail) return;
        const all = n * (n - 1);
        ctx.stats([
          { label: 'polarisation |⟨v̂⟩|', value: polarisation(flock).toFixed(3) },
          { label: 'mean nearest-neighbour distance',
            value: meanNearest(flock, r.radius, grid).toFixed(4) },
          { label: 'pair checks / step', value: `${flock.checks.toLocaleString('en')} of `
            + `${all.toLocaleString('en')} (${((100 * flock.checks) / all).toFixed(1)} %)` },
          { label: 'steps', value: flock.steps.toLocaleString('en') },
        ]);
      },
    };
  },
};

export default boidsMurmuration;
