import { mix, paletteParam, ramp, scale, type RGB } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { Raster } from '../../core/raster';
import { mulberry32 } from '../../core/random';
import { Search, terrain, type Kind, type Terrain } from './search';
import { HOLD_FRAMES, Pacer, paceParam } from '../../core/pace';

const LABELS: Record<Kind, string> = {
  dijkstra: 'Dijkstra',
  astar: 'A*',
  greedy: 'Greedy best-first',
};

export const pathfinding: PlateCode = {
  id: 'pathfinding-terrain',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 140,
  params: [
    {
      kind: 'select', key: 'algorithm', label: 'Algorithm', value: 'astar', rebuild: true,
      options: (Object.keys(LABELS) as Kind[]).map((value) => ({ value, label: LABELS[value] })),
    },
    { kind: 'range', key: 'weight', label: 'A* heuristic weight', min: 1, max: 5, step: 0.1,
      value: 1, rebuild: true },
    { kind: 'range', key: 'rough', label: 'Cost of climbing', min: 0, max: 3, step: 0.1, value: 1.2,
      rebuild: true },
    { kind: 'range', key: 'cell', label: 'Cell size (px)', min: 4, max: 16, step: 1, value: 12,
      rebuild: true },
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'New map when done', value: true },
    paletteParam('phosphor'),
  ],
  pace: { kind: 'replay', unit: 'expansions' },
  create(p, ctx) {
    const pacer = new Pacer('replay', 'expansions', 400);
    const params = ctx.params;
    let map: Terrain;
    let heights: Float64Array;
    let search: Search;
    let raster: Raster;
    let optimum = 0;
    let generation = 0;
    let hold = 0;
    let cell = 7;

    const passable = (i: number) => Number.isFinite(map.cost[i]);

    const build = () => {
      cell = num(params, 'cell');
      const w = Math.max(8, Math.floor(ctx.width / cell));
      const h = Math.max(6, Math.floor(ctx.height / cell));
      const rnd = mulberry32(ctx.seed + generation * 15485863);
      for (let attempt = 0; attempt < 20; attempt++) {
        ({ heights, terrain: map } = terrain(w, h, rnd, num(params, 'rough'), 0.8));
        // start on the left, goal on the right: the cheapest cells of their columns
        const pick = (x: number) => {
          let best = -1;
          for (let y = 1; y < h - 1; y++) {
            const i = y * w + x;
            if (passable(i) && (best < 0 || map.cost[i] < map.cost[best])) best = i;
          }
          return best;
        };
        const start = pick(1);
        const goal = pick(w - 2);
        if (start < 0 || goal < 0) continue;
        const reference = new Search(map, start, goal, 'dijkstra');
        if (reference.run() !== 'found') continue;
        optimum = reference.g[goal];
        const kind = (str(params, 'algorithm') in LABELS ? str(params, 'algorithm') : 'astar') as Kind;
        search = new Search(map, start, goal, kind, num(params, 'weight'));
        // the expansions the whole search makes, counted on a copy
        const copy = new Search(map, start, goal, kind, num(params, 'weight'));
        let steps = 0;
        while (copy.status === 'running') { copy.step(); steps++; }
        pacer.start(steps);
        break;
      }
      raster = new Raster(w, h);
      hold = 0;
    };

    return {
      pace: () => pacer.report(search.status !== 'running', params),
      setup() {
        build();
      },
      draw() {
        const speed = ctx.thumbnail ? 120 : search.status === 'running' ? pacer.take(params) : 0;
        for (let k = 0; k < speed && search.status === 'running'; k++) search.step();
        if (search.status !== 'running') {
          hold++;
          if (bool(params, 'loop') && hold > HOLD_FRAMES && !ctx.thumbnail) {
            generation++;
            build();
          }
        }

        const pal = ctx.palette();
        const wall = mix(ctx.bg, ctx.fg, 0.82);
        const { w, h } = map;
        for (let i = 0; i < w * h; i++) {
          let c: RGB;
          if (!passable(i)) c = wall;
          else {
            // contour bands every tenth of the height range
            const band = Math.floor(heights[i] * 10) % 2 === 0 ? 1 : 0.9;
            c = scale(mix(ctx.bg, ramp(pal, heights[i]), 0.42), band);
            if (search.closed[i]) c = mix(c, ramp(pal, 0.95), 0.35);
            else if (search.open[i]) c = ramp(pal, 1);
          }
          raster.set(i % w, Math.floor(i / w), c[0], c[1], c[2]);
        }
        p.background(...ctx.bg);
        const ox = (ctx.width - w * cell) / 2;
        const oy = (ctx.height - h * cell) / 2;
        raster.blit(p, false, ox, oy, w * cell, h * cell);

        const centre = (i: number): [number, number] =>
          [ox + (i % w + 0.5) * cell, oy + (Math.floor(i / w) + 0.5) * cell];
        const route = search.path();
        if (route.length > 1) {
          p.noFill();
          p.stroke(...ctx.fg);
          p.strokeWeight(Math.max(2, cell * 0.45));
          p.strokeJoin(p.ROUND);
          p.beginShape();
          for (const i of route) p.vertex(...centre(i));
          p.endShape();
        }
        p.noStroke();
        for (const [i, label] of [[search.start, 'A'], [search.goal, 'B']] as const) {
          const [x, y] = centre(i);
          p.fill(...ctx.fg);
          p.circle(x, y, cell * 2.2);
          p.fill(...ctx.bg);
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(Math.max(9, cell * 1.3));
          p.text(label, x, y + 0.5);
        }

        const cost = search.status === 'found' ? search.g[search.goal] : NaN;
        ctx.stats([
          { label: 'algorithm', value: search.kind === 'astar'
            ? `A*, weight ${search.weight}` : LABELS[search.kind] },
          { label: 'expanded cells', value: search.expanded.toLocaleString('en') },
          { label: 'path cost', value: Number.isNaN(cost) ? (search.status === 'failed' ? 'no path' : '…')
            : cost.toFixed(1) },
          { label: 'vs optimum', value: Number.isNaN(cost) ? optimum.toFixed(1)
            : `${(((cost - optimum) / optimum) * 100).toFixed(1)} % above` },
          pacer.row(params),
        ]);
      },
    };
  },
};

export default pathfinding;
