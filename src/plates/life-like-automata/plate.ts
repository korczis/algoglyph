import { mix, paletteParam, ramp } from '../../core/palette';
import { num, str, type PlateCode } from '../../core/plate';
import { Raster } from '../../core/raster';
import { bounds, Life, parseRule, PATTERNS, ruleString, type Pattern, type Rule } from './life';

const RULES: { value: string; label: string }[] = [
  { value: 'B3/S23', label: 'B3/S23 · Conway\'s Life' },
  { value: 'B36/S23', label: 'B36/S23 · HighLife' },
  { value: 'B3678/S34678', label: 'B3678/S34678 · Day & Night' },
  { value: 'B2/S', label: 'B2/S · Seeds' },
  { value: 'B3/S12345', label: 'B3/S12345 · Maze' },
  { value: 'B3/S012345678', label: 'B3/S012345678 · Life without Death' },
];

// Ages past this share the oldest colour; the age ramp is logarithmic below it.
const AGE_CAP = 1023;
const LOG_CAP = Math.log(AGE_CAP + 1);
const CONWAY = parseRule('B3/S23') as Rule;
const CHART_POINTS = 400;

function fmt(n: number): string {
  return n.toLocaleString('en');
}

export const lifeLikeAutomata: PlateCode = {
  id: 'life-like-automata',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 180,
  params: [
    {
      kind: 'select', key: 'rule', label: 'Rule', value: 'B3/S23', options: RULES,
      hint: 'Born / survives on these neighbour counts; switch it mid-run.',
    },
    {
      kind: 'select', key: 'preset', label: 'Start', value: 'soup', rebuild: true,
      options: [
        { value: 'soup', label: 'Random soup' },
        { value: 'rpent', label: 'R-pentomino' },
        { value: 'gun', label: 'Gosper glider gun' },
        { value: 'acorn', label: 'Acorn' },
        { value: 'empty', label: 'Empty (draw with the pointer)' },
      ],
    },
    { kind: 'range', key: 'density', label: 'Soup density', min: 0.05, max: 0.6, step: 0.01,
      value: 0.3, rebuild: true },
    { kind: 'range', key: 'cell', label: 'Cell size (px)', min: 2, max: 10, step: 1, value: 3,
      rebuild: true },
    { kind: 'range', key: 'speed', label: 'Generations per frame', min: 1, max: 20, step: 1,
      value: 2 },
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
    let life: Life;
    let ruleText = '';
    let rule: Rule = CONWAY;
    let paintOn = true;
    let history: [number, number, number, number][] = [];
    // colour tables, rebuilt only when the palette changes
    let lutKey = '';
    const ageLut = new Uint8Array((AGE_CAP + 1) * 3);
    const traceLut = new Uint8Array(256 * 3);

    const tables = () => {
      const pal = ctx.palette();
      if (pal.id === lutKey) return;
      lutKey = pal.id;
      for (let a = 0; a <= AGE_CAP; a++) {
        const u = Math.log(1 + a) / LOG_CAP;
        const c = ramp(pal, dark ? 1 - 0.78 * u : 0.08 + 0.72 * u);
        ageLut.set([c[0], c[1], c[2]], a * 3);
      }
      const trace = mix(ctx.bg, ramp(pal, dark ? 0.32 : 0.55), dark ? 0.75 : 0.55);
      for (let v = 0; v < 256; v++) {
        const c = mix(ctx.bg, trace, Math.pow(v / 255, 1.4));
        traceLut.set([c[0], c[1], c[2]], v * 3);
      }
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
          if (dx * dx + dy * dy > r * r + r) continue;
          const i = life.index(cx + dx, cy + dy);
          if (life.cells[i] && !paintOn) trail[i] = 255;
          life.set(cx + dx, cy + dy, paintOn);
        }
      }
      life.perturbed();
    };

    const seed = () => {
      const preset = str(params, 'preset');
      const centre = (pat: Pattern) => {
        const b = bounds(pat);
        life.place(pat, Math.floor((w - b.w) / 2), Math.floor((h - b.h) / 2));
      };
      if (preset === 'soup') life.soup(num(params, 'density'), ctx.rnd);
      else if (preset === 'rpent') centre(PATTERNS.rPentomino);
      else if (preset === 'acorn') centre(PATTERNS.acorn);
      else if (preset === 'gun') {
        life.place(PATTERNS.gosperGun, Math.floor(w * 0.08), Math.floor(h * 0.12));
      }
      life.perturbed();
    };

    const paint = (fade: number) => {
      const { cells, age, died } = life;
      const px = raster.data;
      for (let i = 0; i < cells.length; i++) {
        let t = trail[i];
        if (died[i]) {
          t = 255;
          died[i] = 0;
        } else t = (t * fade) | 0;
        trail[i] = t;
        let k: number;
        let lut: Uint8Array;
        if (cells[i]) {
          lut = ageLut;
          k = (age[i] > AGE_CAP ? AGE_CAP : age[i]) * 3;
        } else {
          lut = traceLut;
          k = t * 3;
        }
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
        ruleText = '';
        history = [];
        life = new Life(w, h);
        seed();
      },
      pressed(x, y) {
        const [cx, cy] = site(x, y);
        paintOn = !life.get(cx, cy);
        brush(x, y);
      },
      dragged: (x, y) => brush(x, y),
      draw() {
        tables();
        const text = str(params, 'rule');
        if (text !== ruleText) {
          ruleText = text;
          rule = parseRule(text) ?? CONWAY;
          life.perturbed();
        }
        const n = ctx.thumbnail ? 1 : num(params, 'speed');
        for (let k = 0; k < n; k++) life.step(rule);
        paint(num(params, 'fade'));
        p.background(...ctx.bg);
        const [ox, oy] = offset();
        raster.blit(p, false, ox, oy, w * cell, h * cell);

        const g = life;
        if (!ctx.thumbnail) {
          history.push([g.generation, g.population, g.births, g.deaths]);
          if (history.length > CHART_POINTS) history.shift();
          ctx.chart({
            title: 'Population and turnover',
            x: { label: 'generation' },
            y: { label: 'cells' },
            series: [
              { name: 'Live cells', points: history.map((q) => [q[0], q[1]]) },
              { name: 'Born in the last step', points: history.map((q) => [q[0], q[2]]) },
              { name: 'Died in the last step', points: history.map((q) => [q[0], q[3]]) },
            ],
          });
        }
        const canonical = ruleString(rule);
        ctx.stats([
          { label: 'rule', value: RULES.find((r) => r.value === canonical)?.label ?? canonical },
          { label: 'generation', value: fmt(g.generation) },
          { label: 'population', value:
            `${fmt(g.population)} (${((100 * g.population) / (w * h)).toFixed(1)} %)` },
          { label: 'last step', value: `${fmt(g.births)} born, ${fmt(g.deaths)} died` },
          { label: 'period of the board', value: g.period
            ? `${fmt(g.period)}, cycle from generation ${fmt(g.cycleStart)}`
            : `not periodic in the last ${fmt(g.remembered)} boards` },
          { label: 'board', value: `${w}×${h} (torus)` },
        ]);
      },
    };
  },
};

export default lifeLikeAutomata;
