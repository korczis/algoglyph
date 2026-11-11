import { mix, paletteParam, ramp, type RGB } from '../../core/palette';
import { num, str, type PlateCode } from '../../core/plate';
import { Raster } from '../../core/raster';
import { parseTurmite, Turmite, type Ant } from './ant';

const TURMITES = ['RL', 'RLR', 'LLRR', 'LRRRRRLLR', 'RRLLLRLLLRRR'];
const CHART_POINTS = 400;

function fmt(n: number): string {
  return n.toLocaleString('en');
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export const langtonTurmites: PlateCode = {
  id: 'langton-turmites',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 180,
  params: [
    {
      kind: 'select', key: 'turmite', label: 'Rule', value: 'RL', rebuild: true,
      options: TURMITES.map((t) => ({ value: t, label: t === 'RL' ? 'RL · Langton\'s ant' : t })),
      hint: 'One turn per colour: R right, L left.',
    },
    { kind: 'range', key: 'ants', label: 'Ants', min: 1, max: 8, step: 1, value: 1,
      rebuild: true },
    { kind: 'range', key: 'cell', label: 'Cell size (px)', min: 2, max: 10, step: 1, value: 3,
      rebuild: true },
    { kind: 'range', key: 'speed', label: 'Steps per frame', min: 1, max: 4000, step: 1,
      value: 120, hint: 'Langton\'s highway starts near step 10 000.' },
    { kind: 'range', key: 'fade', label: 'Trail fade per frame', min: 0.8, max: 0.995,
      step: 0.005, value: 0.94 },
    paletteParam('ember'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    const dark = ctx.theme === 'dark';
    let cell = 3;
    let w = 0;
    let h = 0;
    let raster: Raster;
    let trail: Uint8Array;
    let ant: Turmite;
    let paintOn = true;
    let history: [number, number, number][] = [];
    // colour tables per cell colour and glow level, rebuilt only when the palette changes
    let lutKey = '';
    let lut = new Uint8Array(0);
    let ink: RGB = [0, 0, 0];

    const tables = () => {
      const pal = ctx.palette();
      if (pal.id === lutKey) return;
      lutKey = pal.id;
      const colours = ant.colours;
      lut = new Uint8Array(colours * 256 * 3);
      const glow = ramp(pal, dark ? 1 : 0);
      for (let s = 0; s < colours; s++) {
        const f = s / Math.max(1, colours - 1);
        const base = s === 0 ? ctx.bg
          : mix(ctx.bg, ramp(pal, dark ? 0.2 + 0.55 * f : 0.8 - 0.55 * f), 0.92);
        for (let v = 0; v < 256; v++) {
          const c = mix(base, glow, 0.8 * Math.pow(v / 255, 2));
          lut.set([c[0], c[1], c[2]], (s * 256 + v) * 3);
        }
      }
      ink = glow;
    };

    const offset = () => [(ctx.width - w * cell) / 2, (ctx.height - h * cell) / 2];

    const site = (x: number, y: number) => {
      const [ox, oy] = offset();
      return [Math.floor((x - ox) / cell), Math.floor((y - oy) / cell)];
    };

    const brush = (x: number, y: number) => {
      const [cx, cy] = site(x, y);
      const r = Math.max(1, Math.round(9 / cell));
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r + r) ant.paint(cx + dx, cy + dy, paintOn ? 1 : 0);
        }
      }
    };

    const paint = (fade: number) => {
      const { grid, touched } = ant;
      const px = raster.data;
      for (let i = 0; i < grid.length; i++) {
        let t = trail[i];
        if (touched[i]) {
          t = 255;
          touched[i] = 0;
        } else t = (t * fade) | 0;
        trail[i] = t;
        const k = (grid[i] * 256 + t) * 3;
        const o = i * 4;
        px[o] = lut[k];
        px[o + 1] = lut[k + 1];
        px[o + 2] = lut[k + 2];
        px[o + 3] = 255;
      }
    };

    return {
      setup() {
        cell = num(params, 'cell');
        w = Math.max(16, Math.floor(ctx.width / cell));
        h = Math.max(16, Math.floor(ctx.height / cell));
        raster = new Raster(w, h);
        raster.fill(ctx.bg);
        trail = new Uint8Array(w * h);
        lutKey = '';
        history = [];
        const turns = parseTurmite(str(params, 'turmite')) ?? [1, 3];
        const ants: Ant[] = [{ x: Math.floor(w / 2), y: Math.floor(h / 2), dir: 0 }];
        for (let k = 1; k < num(params, 'ants'); k++) {
          ants.push({ x: Math.floor(ctx.rnd() * w), y: Math.floor(ctx.rnd() * h),
            dir: Math.floor(ctx.rnd() * 4) });
        }
        ant = new Turmite(w, h, turns, ants);
      },
      pressed(x, y) {
        const [cx, cy] = site(x, y);
        paintOn = ant.colourAt(cx, cy) === 0;
        brush(x, y);
      },
      dragged: (x, y) => brush(x, y),
      draw() {
        tables();
        const n = ctx.thumbnail ? 160 : num(params, 'speed');
        for (let k = 0; k < n; k++) ant.step();
        paint(num(params, 'fade'));
        p.background(...ctx.bg);
        const [ox, oy] = offset();
        raster.blit(p, false, ox, oy, w * cell, h * cell);
        const size = Math.max(3, cell * 1.6);
        p.noStroke();
        for (const it of ant.ants) {
          const cx = ox + (it.x + 0.5) * cell;
          const cy = oy + (it.y + 0.5) * cell;
          p.fill(ink[0], ink[1], ink[2], 60);
          p.circle(cx, cy, size * 2.6);
          p.fill(...ctx.fg);
          p.circle(cx, cy, size);
        }

        const a = ant;
        if (!ctx.thumbnail) {
          history.push([a.steps, a.visitedCount, a.coloured]);
          if (history.length > CHART_POINTS) history.shift();
          ctx.chart({
            title: 'Cells the ants have reached',
            x: { label: 'step' },
            y: { label: 'cells' },
            series: [
              { name: 'Visited at least once', points: history.map((q) => [q[0], q[1]]) },
              { name: 'Not colour 0 now', points: history.map((q) => [q[0], q[2]]) },
            ],
          });
        }
        const hw = a.highway();
        ctx.stats([
          { label: 'rule', value: `${str(params, 'turmite')} (${a.colours} colours), `
            + `${a.ants.length} ant${a.ants.length > 1 ? 's' : ''}` },
          { label: 'steps', value: fmt(a.steps) },
          { label: 'cells visited', value:
            `${fmt(a.visitedCount)} (${((100 * a.visitedCount) / (w * h)).toFixed(1)} %)` },
          { label: 'coloured cells', value: fmt(a.coloured) },
          { label: 'highway (first ant)', value: hw
            ? `period ${hw.period}, moves (${signed(hw.dx)}, ${signed(hw.dy)}) per period, `
              + `since step ${hw.exact ? '' : '≤ '}${fmt(hw.since)}`
            : 'none detected' },
          { label: 'board', value: `${w}×${h} (torus)` },
        ]);
      },
    };
  },
};

export default langtonTurmites;
