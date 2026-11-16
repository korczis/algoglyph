import { mix, paletteParam, ramp, scale, type RGB } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import { Raster } from '../../core/raster';
import { HOLD_FRAMES, Pacer, paceParam } from '../../core/pace';
import { DEFAULT_COSTS, DEFAULT_RULES, HEADINGS, search, type Plan, type Piece } from './plan';
import { terrain, type Terrain } from './terrain';

const DX = [-1, 0, 1, 0];
const DY = [0, 1, 0, -1];
/** The sides each TrackBits piece joins (NE 0, SE 1, SW 2, NW 3). */
const SIDES: Record<number, [number, number]> = { 1: [0, 2], 2: [1, 3], 4: [3, 0], 32: [0, 1], 8: [1, 2], 16: [2, 3] };
/** The midpoint of a tile's side, in tile units from its north corner. */
const MID: [number, number][] = [[0, 0.5], [0.5, 1], [1, 0.5], [0.5, 0]];
/**
 * CPU milliseconds of search a frame may spend (config/budgets.yaml allows 40 per frame on the
 * reference machine): A* and the Dijkstra reference run a slice per frame, so the largest map
 * (tile size 8 at 1440 px, about 300 000 states for both) costs no frame more than this.
 */
const SLICE_MS = 6;
/** Expansions between clock reads: about 2 ms of search, so a slice overshoots by no more. */
const CHUNK = 512;
/**
 * The smallest map in tiles: room for the river, the ridge and both station sites without
 * overlapping (a 16 × 10 map put the river three vertices from a site five levels up, a slope the
 * one-level rule cannot settle). The tile size shrinks on a narrow canvas to keep it.
 */
const MIN_W = 24;
const MIN_H = 14;
const PENDING: Plan = { status: 'unreachable', cost: Infinity, pieces: [], runs: [], expanded: 0, counts: { tiles: 0, length: 0, curves: 0, sharp: 0, bridges: 0, tunnels: 0, foundations: 0, inclines: 0, crossings: 0, cleared: 0 } };

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
    let route: Plan = PENDING;
    let reference: Plan = PENDING;
    // the searches still running: A* first (its plan is drawn), then Dijkstra (the readout's reference)
    let pending: { it: Generator<number, Plan, void>; into: 'route' | 'reference'; expanded: number }[] = [];
    let raster: Raster;
    let shown = 0;
    let hold = 0;
    let generation = 0;
    let cell = 16;
    let painted: ReturnType<typeof ctx.palette> | null = null;

    function build() {
      cell = Math.max(2, Math.min(num(params, 'cell'), Math.floor(ctx.width / MIN_W), Math.floor(ctx.height / MIN_H)));
      const w = Math.floor(ctx.width / cell);
      const h = Math.floor(ctx.height / cell);
      world = terrain(w, h, ctx.seed + generation * 7919);
      const costs = { ...DEFAULT_COSTS, bridge: num(params, 'bridge'), tunnel: num(params, 'tunnel'), curve: num(params, 'curve'), incline: num(params, 'incline') };
      const rules = { ...DEFAULT_RULES, forbid90: bool(params, 'forbid90'), steep: bool(params, 'steep') };
      const from = { x: world.a[0], y: world.a[1], dir: 'SW' as const };
      const to = { x: world.b[0], y: world.b[1] };
      route = PENDING;
      reference = PENDING;
      pending = [
        { it: search(world.map, from, to, costs, rules, true, CHUNK), into: 'route', expanded: 0 },
        { it: search(world.map, from, to, costs, rules, false, CHUNK), into: 'reference', expanded: 0 },
      ];
      raster = new Raster(w, h);
      painted = null;
      shown = 0;
      hold = 0;
      advance(ctx.thumbnail ? Infinity : SLICE_MS);
    }

    /** Shade every tile into the raster: height, light from the north, water, houses, trees. */
    function paint(pal: ReturnType<typeof ctx.palette>) {
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
    }

    /** Run the pending searches for at most `ms` of this frame; a finished A* starts the replay. */
    function advance(ms: number) {
      const t0 = performance.now();
      while (pending.length && performance.now() - t0 < ms) {
        const s = pending[0];
        const r = s.it.next();
        if (!r.done) { s.expanded = r.value; continue; }
        pending.shift();
        if (s.into === 'route') { route = r.value; pacer.start(route.pieces.length); } else reference = r.value;
      }
    }
    const searching = (into: 'route' | 'reference') => pending.find((s) => s.into === into);

    const pieceColour = (q: Piece, fg: RGB, pal: ReturnType<typeof ctx.palette>): RGB =>
      q.kind === 'bridge' ? ramp(pal, 0.95) : q.kind === 'tunnel' ? mix(ctx.bg, fg, 0.55) : fg;

    return {
      pace: () => pacer.report(!pending.length && shown >= route.pieces.length, params),
      setup() { build(); },
      draw() {
        if (pending.length) advance(SLICE_MS);
        const done = !pending.length && shown >= route.pieces.length;
        shown = Math.min(route.pieces.length, shown + (ctx.thumbnail ? route.pieces.length : done ? 0 : pacer.take(params)));
        if (done) {
          hold++;
          if (bool(params, 'loop') && hold > HOLD_FRAMES && !ctx.thumbnail) { generation++; build(); }
        }
        const pal = ctx.palette();
        const { map } = world;
        const tw = map.w - 1; const th = map.h - 1;
        // the terrain changes only with a new map or palette: paint it once, blit it every frame
        if (painted !== pal) { paint(pal); painted = pal; }
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
        const a = searching('route'); const dj = searching('reference');
        const states = (pl: Plan, s: typeof a) => (s ? `${s.expanded.toLocaleString('en')}…` : pl.expanded.toLocaleString('en'));
        ctx.stats([
          { label: 'plan cost', value: a ? 'searching…' : found ? route.cost.toFixed(2) : route.status === 'budget' ? 'search budget spent' : 'no route' },
          { label: 'vs Dijkstra', value: dj ? 'searching…' : found && reference.status === 'found' ? `${(((route.cost - reference.cost) / reference.cost) * 100).toFixed(1)} % above` : '—' },
          { label: 'track tiles', value: String(c.tiles) },
          { label: 'length', value: c.length.toFixed(2) },
          { label: '45° turns', value: String(c.curves) },
          { label: 'bridges', value: String(c.bridges) },
          { label: 'tunnels', value: String(c.tunnels) },
          { label: 'foundations', value: String(c.foundations) },
          { label: 'inclines', value: String(c.inclines) },
          { label: 'expanded states', value: `${states(route, a)} (Dijkstra ${states(reference, dj)})` },
          pacer.row(params),
        ]);
      },
    };
  },
};

export default trackPlanning;
