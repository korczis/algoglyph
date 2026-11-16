import { mix, paletteParam, ramp, scale, type RGB } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import { Raster } from '../../core/raster';
import { HOLD_FRAMES, Pacer, paceParam } from '../../core/pace';
import { DEFAULT_COSTS, DEFAULT_RULES, HEADINGS, plan, type Plan, type Piece } from './plan';
import { terrain, type Terrain } from './terrain';

const DX = [-1, 0, 1, 0];
const DY = [0, 1, 0, -1];
/** The sides each TrackBits piece joins (NE 0, SE 1, SW 2, NW 3). */
const SIDES: Record<number, [number, number]> = { 1: [0, 2], 2: [1, 3], 4: [3, 0], 32: [0, 1], 8: [1, 2], 16: [2, 3] };
/** The midpoint of a tile's side, in tile units from its north corner. */
const MID: [number, number][] = [[0, 0.5], [0.5, 1], [1, 0.5], [0.5, 0]];

export const trackPlanning: PlateCode = {
  id: 'track-planning',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 120,
  params: [
    { kind: 'range', key: 'bridge', label: 'Bridge cost per tile', min: 0.75, max: 10, step: 0.25, value: DEFAULT_COSTS.bridge, rebuild: true },
    { kind: 'range', key: 'tunnel', label: 'Tunnel cost per tile', min: 0.75, max: 10, step: 0.25, value: DEFAULT_COSTS.tunnel, rebuild: true },
    { kind: 'range', key: 'curve', label: 'Cost of a 45° turn', min: 0, max: 4, step: 0.25, value: DEFAULT_COSTS.curve, rebuild: true },
    { kind: 'range', key: 'incline', label: 'Cost of an incline', min: 0, max: 4, step: 0.25, value: DEFAULT_COSTS.incline, rebuild: true },
    { kind: 'toggle', key: 'forbid90', label: 'Forbid 90° turns', value: DEFAULT_RULES.forbid90, rebuild: true },
    { kind: 'toggle', key: 'steep', label: 'Track on steep slopes', value: DEFAULT_RULES.steep, rebuild: true },
    { kind: 'range', key: 'cell', label: 'Tile size (px)', min: 8, max: 24, step: 1, value: 16, rebuild: true },
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'New map when done', value: true },
    paletteParam('abyss'),
  ],
  pace: { kind: 'replay', unit: 'pieces' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'pieces', 6);
    let world: Terrain;
    let route: Plan;
    let reference: Plan;
    let raster: Raster;
    let shown = 0;
    let hold = 0;
    let generation = 0;
    let cell = 16;

    function build() {
      cell = num(params, 'cell');
      const w = Math.max(16, Math.floor(ctx.width / cell));
      const h = Math.max(10, Math.floor(ctx.height / cell));
      world = terrain(w, h, ctx.seed + generation * 7919);
      const costs = { ...DEFAULT_COSTS, bridge: num(params, 'bridge'), tunnel: num(params, 'tunnel'), curve: num(params, 'curve'), incline: num(params, 'incline') };
      const rules = { ...DEFAULT_RULES, forbid90: bool(params, 'forbid90'), steep: bool(params, 'steep') };
      const from = { x: world.a[0], y: world.a[1], dir: 'SW' as const };
      const to = { x: world.b[0], y: world.b[1] };
      route = plan(world.map, from, to, costs, rules);
      reference = plan(world.map, from, to, costs, rules, false);
      raster = new Raster(w, h);
      shown = 0;
      hold = 0;
      pacer.start(route.pieces.length);
    }

    const pieceColour = (q: Piece, fg: RGB, pal: ReturnType<typeof ctx.palette>): RGB =>
      q.kind === 'bridge' ? ramp(pal, 0.95) : q.kind === 'tunnel' ? mix(ctx.bg, fg, 0.55) : fg;

    return {
      pace: () => pacer.report(shown >= route.pieces.length, params),
      setup() { build(); },
      draw() {
        const done = shown >= route.pieces.length;
        shown = Math.min(route.pieces.length, shown + (ctx.thumbnail ? route.pieces.length : done ? 0 : pacer.take(params)));
        if (done) {
          hold++;
          if (bool(params, 'loop') && hold > HOLD_FRAMES && !ctx.thumbnail) { generation++; build(); }
        }
        const pal = ctx.palette();
        const { map } = world;
        const tw = map.w - 1; const th = map.h - 1;
        for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
          const k = [map.heights[y * map.w + x], map.heights[(y + 1) * map.w + x], map.heights[(y + 1) * map.w + x + 1], map.heights[y * map.w + x + 1]];
          const top = Math.max(...k);
          const t = String.fromCharCode(map.types[y * map.w + x]);
          let c: RGB = mix(ctx.bg, ramp(pal, 0.15 + 0.14 * top), 0.55);
          // light from the north: a tile falling to the south-east is darker
          c = scale(c, 1 + 0.06 * ((k[0] + k[3]) - (k[1] + k[2])));
          if (t === 'W') c = mix(ctx.bg, ramp(pal, 0.02), 0.85);
          else if (t === 'H') c = mix(ctx.bg, ctx.fg, 0.7);
          else if (t === 'T') c = scale(c, 0.8);
          else if (t === 'S') c = mix(ctx.bg, ctx.fg, 0.9);
          raster.set(x, y, c[0], c[1], c[2]);
        }
        p.background(...ctx.bg);
        const ox = (ctx.width - tw * cell) / 2;
        const oy = (ctx.height - th * cell) / 2;
        raster.blit(p, false, ox, oy, tw * cell, th * cell);
        const sx = (x: number) => ox + x * cell;
        const sy = (y: number) => oy + y * cell;
        p.strokeCap(p.ROUND);
        for (const q of route.pieces.slice(0, shown)) {
          const col = pieceColour(q, ctx.fg, pal);
          if (q.kind === 'track') {
            const [s1, s2] = SIDES[q.track];
            p.stroke(...col);
            p.strokeWeight(Math.max(2, cell * 0.28));
            p.line(sx(q.x + MID[s1][0]), sy(q.y + MID[s1][1]), sx(q.x + MID[s2][0]), sy(q.y + MID[s2][1]));
            if (q.foundation) { p.noFill(); p.stroke(...mix(ctx.bg, ctx.fg, 0.45)); p.strokeWeight(1); p.rect(sx(q.x) + 1, sy(q.y) + 1, cell - 2, cell - 2); }
          } else {
            const d = HEADINGS.indexOf(q.heading);
            const [ax, ay] = q.from; const [bx, by] = q.to;
            const x0 = sx(ax + 0.5 - DX[d] * 0.5); const y0 = sy(ay + 0.5 - DY[d] * 0.5);
            const x1 = sx(bx + 0.5 + DX[d] * 0.5); const y1 = sy(by + 0.5 + DY[d] * 0.5);
            p.stroke(...col);
            if (q.kind === 'bridge') {
              p.strokeWeight(Math.max(3, cell * 0.5));
              p.line(x0, y0, x1, y1);
              p.stroke(...ctx.fg); p.strokeWeight(Math.max(1, cell * 0.12));
              p.line(x0, y0, x1, y1);
            } else {
              p.strokeWeight(Math.max(2, cell * 0.28));
              const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / (cell * 0.5)));
              for (let i = 0; i < n; i += 2) p.line(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, x0 + ((x1 - x0) * (i + 1)) / n, y0 + ((y1 - y0) * (i + 1)) / n);
            }
          }
        }
        p.noStroke();
        for (const [[x, y], label] of [[world.a, 'A'], [world.b, 'B']] as const) {
          p.fill(...ctx.fg);
          p.circle(sx(x + 0.5), sy(y + 0.5), cell * 1.6);
          p.fill(...ctx.bg);
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(Math.max(9, cell * 0.9));
          p.text(label, sx(x + 0.5), sy(y + 0.5) + 0.5);
        }
        const found = route.status === 'found';
        const c = route.counts;
        ctx.stats([
          { label: 'plan cost', value: found ? route.cost.toFixed(2) : route.status === 'budget' ? 'search budget spent' : 'no route' },
          { label: 'vs Dijkstra', value: found && reference.status === 'found' ? `${(((route.cost - reference.cost) / reference.cost) * 100).toFixed(1)} % above` : '—' },
          { label: 'track tiles', value: String(c.tiles) },
          { label: 'length', value: c.length.toFixed(2) },
          { label: '45° turns', value: String(c.curves) },
          { label: 'bridges', value: String(c.bridges) },
          { label: 'tunnels', value: String(c.tunnels) },
          { label: 'foundations', value: String(c.foundations) },
          { label: 'inclines', value: String(c.inclines) },
          { label: 'expanded states', value: `${route.expanded.toLocaleString('en')} (Dijkstra ${reference.expanded.toLocaleString('en')})` },
          pacer.row(params),
        ]);
      },
    };
  },
};

export default trackPlanning;
