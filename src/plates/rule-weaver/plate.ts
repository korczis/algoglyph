import { paletteParam, ramp } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { Raster } from '../../core/raster';
import { binary, neighbourhoods, next } from './rule';

export const ruleWeaver: PlateCode = {
  id: 'rule-weaver',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 220,
  params: [
    { kind: 'range', key: 'rule', label: 'Rule', min: 0, max: 255, step: 1, value: 30 },
    { kind: 'range', key: 'cell', label: 'Cell size (px)', min: 2, max: 12, step: 1, value: 4,
      rebuild: true },
    {
      kind: 'select', key: 'start', label: 'First row', value: 'single', rebuild: true,
      options: [
        { value: 'single', label: 'A single live cell' },
        { value: 'random', label: 'Random, 50 %' },
        { value: 'sparse', label: 'Random, 8 %' },
      ],
    },
    { kind: 'range', key: 'speed', label: 'Generations per frame', min: 1, max: 8, step: 1, value: 2 },
    { kind: 'toggle', key: 'legend', label: 'Show the rule legend', value: true },
    paletteParam('riso'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let raster: Raster;
    let row: Uint8Array;
    let hood: Uint8Array;
    let nextRow: Uint8Array;
    let generation = 0;
    let cell = 4;

    const paint = (y: number) => {
      const pal = ctx.palette();
      for (let x = 0; x < row.length; x++) {
        if (row[x]) {
          const c = ramp(pal, hood[x] / 7);
          raster.set(x, y, c[0], c[1], c[2]);
        } else raster.set(x, y, ctx.bg[0], ctx.bg[1], ctx.bg[2]);
      }
    };

    return {
      setup() {
        cell = num(params, 'cell');
        const cols = Math.floor(ctx.width / cell);
        const rows = Math.floor(ctx.height / cell);
        raster = new Raster(cols, rows);
        raster.fill(ctx.bg);
        row = new Uint8Array(cols);
        hood = new Uint8Array(cols);
        nextRow = new Uint8Array(cols);
        const start = str(params, 'start');
        if (start === 'single') row[Math.floor(cols / 2)] = 1;
        else {
          const density = start === 'sparse' ? 0.08 : 0.5;
          for (let i = 0; i < cols; i++) row[i] = ctx.rnd() < density ? 1 : 0;
        }
        hood.fill(7);
        paint(0);
        generation = 1;
      },
      draw() {
        const rule = num(params, 'rule');
        const steps = num(params, 'speed');
        for (let k = 0; k < steps; k++) {
          // hood keeps the parents' neighbourhoods, so paint() colours a cell by its birth
          neighbourhoods(row, hood);
          next(rule, hood, nextRow);
          [row, nextRow] = [nextRow, row];
          if (generation >= raster.h) raster.scrollUp(1);
          paint(Math.min(generation, raster.h - 1));
          generation++;
        }
        p.background(...ctx.bg);
        raster.blit(p, false, 0, 0, raster.w * cell, raster.h * cell);

        if (bool(params, 'legend')) {
          const pal = ctx.palette();
          const s = 7;
          const pad = 10;
          const w = 8 * (3 * s + 6) + pad * 2 - 6;
          p.noStroke();
          p.fill(ctx.bg[0], ctx.bg[1], ctx.bg[2], 225);
          p.rect(pad, pad, w, s * 2 + 30, 6);
          for (let k = 7; k >= 0; k--) {
            const x0 = pad * 2 + (7 - k) * (3 * s + 6);
            const y0 = pad * 2;
            for (let b = 0; b < 3; b++) {
              const on = (k >> (2 - b)) & 1;
              if (on) p.fill(...ctx.fg);
              else p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 40);
              p.rect(x0 + b * s, y0, s - 1, s - 1);
            }
            const out = (rule >> k) & 1;
            if (out) p.fill(...ramp(pal, k / 7));
            else p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 40);
            p.rect(x0 + s, y0 + s + 2, s - 1, s - 1);
          }
          p.fill(...ctx.fg);
          p.textFont('monospace');
          p.textSize(11);
          p.text(`RULE ${rule}  ${binary(rule)}`, pad * 2, pad * 2 + s * 2 + 16);
        }

        let alive = 0;
        for (let i = 0; i < row.length; i++) alive += row[i];
        ctx.stats([
          { label: 'rule', value: `${rule} = ${binary(rule)}₂` },
          { label: 'generation', value: generation.toLocaleString('en') },
          { label: 'live cells', value: `${((100 * alive) / row.length).toFixed(1)} %` },
          { label: 'width', value: `${row.length} cells (ring)` },
        ]);
      },
    };
  },
};

export default ruleWeaver;
