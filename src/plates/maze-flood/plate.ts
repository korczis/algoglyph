import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import { backtracker, E, flood, floodStep, grid, path, prim, S, type Flood, type Grid } from './maze';

type Phase = 'carve' | 'flood' | 'path' | 'hold';

export const mazeFlood: PlateCode = {
  id: 'maze-flood',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 120,
  params: [
    {
      kind: 'select', key: 'generator', label: 'Generator', value: 'backtracker', rebuild: true,
      options: [
        { value: 'backtracker', label: 'Recursive backtracker' },
        { value: 'prim', label: 'Randomised Prim' },
      ],
    },
    { kind: 'range', key: 'cell', label: 'Cell size (px)', min: 8, max: 48, step: 1, value: 16,
      rebuild: true },
    { kind: 'range', key: 'speed', label: 'Steps per frame', min: 1, max: 200, step: 1, value: 30 },
    { kind: 'toggle', key: 'loop', label: 'Regenerate when done', value: true },
    paletteParam('abyss'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let g: Grid;
    let carver: Generator<number>;
    let fl: Flood;
    let phase: Phase = 'carve';
    let head = -1;
    let route: number[] = [];
    let shown = 0;
    let hold = 0;
    let generation = 0;
    let cell = 16;
    let source = 0;

    const build = () => {
      cell = num(params, 'cell');
      const cols = Math.max(4, Math.floor(ctx.width / cell));
      const rows = Math.max(4, Math.floor(ctx.height / cell));
      g = grid(cols, rows);
      source = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
      const rnd = mulberry32(ctx.seed + generation * 104729);
      carver = str(params, 'generator') === 'prim' ? prim(g, rnd, source) : backtracker(g, rnd, source);
      phase = 'carve';
      route = [];
      shown = 0;
      hold = 0;
      head = source;
    };

    const advance = (steps: number) => {
      for (let k = 0; k < steps; k++) {
        if (phase === 'carve') {
          const r = carver.next();
          if (r.done) {
            phase = 'flood';
            fl = flood(g, source);
          } else head = r.value;
        } else if (phase === 'flood') {
          if (!floodStep(g, fl)) {
            phase = 'path';
            route = path(g, fl, fl.far);
          }
        } else if (phase === 'path') {
          shown = Math.min(route.length, shown + 1);
          if (shown === route.length) phase = 'hold';
        }
      }
    };

    return {
      setup() {
        p.strokeCap(p.ROUND);
        build();
      },
      draw() {
        advance(num(params, 'speed'));
        if (phase === 'hold') {
          hold++;
          if (bool(params, 'loop') && hold > 150 && !ctx.thumbnail) {
            generation++;
            build();
          }
        }

        const pal = ctx.palette();
        const ox = (ctx.width - g.cols * cell) / 2 + cell / 2;
        const oy = (ctx.height - g.rows * cell) / 2 + cell / 2;
        const carved: [number, number, number] = mix(ctx.bg, ctx.fg, 0.22);
        p.background(...ctx.bg);
        p.strokeWeight(Math.max(2, cell * 0.56));
        const max = phase === 'carve' ? 1 : Math.max(1, fl.max);
        for (let i = 0; i < g.open.length; i++) {
          const o = g.open[i];
          if (!o) continue;
          const x = ox + (i % g.cols) * cell;
          const y = oy + Math.floor(i / g.cols) * cell;
          const d = phase === 'carve' ? -1 : fl.dist[i];
          const c = d < 0 ? carved : ramp(pal, d / max);
          p.stroke(...c);
          if (o & E) p.line(x, y, x + cell, y);
          if (o & S) p.line(x, y, x, y + cell);
          if (!(o & (E | S))) p.point(x, y);
        }
        if (phase === 'carve' && head >= 0) {
          p.stroke(...ctx.fg);
          p.strokeWeight(cell * 0.9);
          p.point(ox + (head % g.cols) * cell, oy + Math.floor(head / g.cols) * cell);
        }
        if (shown > 1) {
          p.stroke(...ctx.fg);
          p.strokeWeight(Math.max(1.5, cell * 0.18));
          p.noFill();
          p.beginShape();
          for (let k = 0; k < shown; k++) {
            const i = route[k];
            p.vertex(ox + (i % g.cols) * cell, oy + Math.floor(i / g.cols) * cell);
          }
          p.endShape();
        }

        ctx.stats([
          { label: 'phase', value: phase },
          { label: 'cells', value: (g.cols * g.rows).toLocaleString('en') },
          { label: 'flood frontier', value: phase === 'carve' ? '–' : String(fl.tail - fl.head) },
          { label: 'longest shortest path', value: phase === 'carve' ? '–' : String(fl.max) },
        ]);
      },
    };
  },
};

export default mazeFlood;
