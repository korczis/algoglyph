// Frozen for test/hot-loops: src/plates/pathfinding-terrain/plate.ts as it was before fix/hot-loop-imports, verbatim except that
// imports outside the frozen files point at today's modules under src/.
import { mix, paletteParam, ramp, scale, type RGB } from '../../../../../../src/core/palette';
import { bool, num, str, type PlateCode } from '../../../../../../src/core/plate';
import { Raster } from '../../../../../../src/core/raster';
import { mulberry32 } from '../../../../../../src/core/random';
import { Search, terrain, type Kind, type Terrain } from '../../../../../../src/plates/pathfinding-terrain/search';
import { HOLD_FRAMES, Pacer, paceParam } from '../../../../../../src/core/pace';

/**
 * Map-building work one frame may do past the end of a run, counted, never timed: the cells of
 * each terrain drawn plus the cells the build's two searches expand (the Dijkstra that proves a
 * path exists, and the copy that counts the run's expansions for the pacer). At 4 px cells a
 * 1440 px map is 360 × 225 cells, and built inside one frame it took 34.4 ms there; at this count
 * it builds over the frames of the end-of-run hold while the finished map stays on screen. A
 * default map (66 × 41 cells at 800 px, 120 × 75 at 1440 px) still builds inside one frame.
 */
export const BUILD_UNITS = 40_000;

const LABELS: Record<Kind, string> = {
  dijkstra: 'Dijkstra',
  astar: 'A*',
  greedy: 'Greedy best-first',
};

type Build = Generator<undefined, void, undefined>;

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
    // a cell at or above this normalised height is a wall. Down to 0.55, measured where the 20 map
    // attempts start failing: at 0.5, 20 of 1,935 builds (widths 390, 800 and 1440 px, cells 4 to
    // 16 px, 43 seeds, 3 generations) found no map with a passable start, goal and path between,
    // and at 0.55 none of 18,135 did (403 seeds), one of them on its 20th attempt (2026-11-15).
    // Up to 1, since the heights are normalised to [0, 1]: there only the highest cell is a wall
    { kind: 'range', key: 'wall', label: 'Wall height', min: 0.55, max: 1, step: 0.05, value: 0.8,
      rebuild: true, hint: 'Cells at least this high are walls; lower walls close more of the map.' },
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
    // null when every attempt below failed: no map had a passable start, goal and a path between
    let search: Search | null = null;
    let raster: Raster;
    let optimum = 0;
    let generation = 0;
    let hold = 0;
    let cell = 7;
    // the work left in this frame's share; a build pauses before work once it is used up
    let left = Infinity;
    // the next map, built over the frames of the end-of-run hold; null when none is under way
    let next: Build | null = null;

    const passable = (i: number) => Number.isFinite(map.cost[i]);

    /**
     * One map: up to 20 terrains until one has a passable start, goal and a path between. It is
     * built into locals and installed at its end, so the finished map stays on screen meanwhile.
     */
    function* build(): Build {
      const size = num(params, 'cell');
      const w = Math.max(8, Math.floor(ctx.width / size));
      const h = Math.max(6, Math.floor(ctx.height / size));
      const rnd = mulberry32(ctx.seed + generation * 15485863);
      let t: Terrain | undefined;
      let hs: Float64Array | undefined;
      let found: { search: Search; optimum: number; steps: number } | null = null;
      for (let attempt = 0; attempt < 20; attempt++) {
        if (left <= 0) yield;
        ({ heights: hs, terrain: t } = terrain(w, h, rnd, num(params, 'rough'), num(params, 'wall')));
        left -= w * h;
        const m = t;
        // start on the left, goal on the right: the cheapest cells of their columns
        const pick = (x: number) => {
          let best = -1;
          for (let y = 1; y < h - 1; y++) {
            const i = y * w + x;
            if (Number.isFinite(m.cost[i]) && (best < 0 || m.cost[i] < m.cost[best])) best = i;
          }
          return best;
        };
        const start = pick(1);
        const goal = pick(w - 2);
        if (start < 0 || goal < 0) continue;
        const reference = new Search(m, start, goal, 'dijkstra');
        while (reference.status === 'running') {
          if (left <= 0) yield;
          reference.step();
          left--;
        }
        if (reference.status !== 'found') continue;
        const kind = (str(params, 'algorithm') in LABELS ? str(params, 'algorithm') : 'astar') as Kind;
        // the expansions the whole search makes, counted on a copy
        const copy = new Search(m, start, goal, kind, num(params, 'weight'));
        let steps = 0;
        while (copy.status === 'running') {
          if (left <= 0) yield;
          copy.step();
          steps++;
          left--;
        }
        found = {
          search: new Search(m, start, goal, kind, num(params, 'weight')),
          optimum: reference.g[goal],
          steps,
        };
        break;
      }
      cell = size;
      map = t!;
      heights = hs!;
      search = found ? found.search : null;
      if (found) optimum = found.optimum;
      pacer.start(found ? found.steps : 0);
      raster = new Raster(w, h);
      hold = 0;
    }

    /** Resume a build for at most `units` of work; true once its map is installed. */
    const advance = (job: Build, units: number) => {
      left = units;
      return job.next().done === true;
    };

    return {
      pace: () => pacer.report(!search || search.status !== 'running', params),
      setup() {
        advance(build(), Infinity);
      },
      draw() {
        const running = () => search?.status === 'running';
        const speed = ctx.thumbnail ? 120 : running() ? pacer.take(params) : 0;
        for (let k = 0; k < speed && running(); k++) search?.step();
        if (!running()) {
          hold++;
          if (bool(params, 'loop') && hold > HOLD_FRAMES && !ctx.thumbnail) {
            if (!next) {
              generation++;
              next = build();
            }
            if (advance(next, BUILD_UNITS)) next = null;
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
            if (search?.closed[i]) c = mix(c, ramp(pal, 0.95), 0.35);
            else if (search?.open[i]) c = ramp(pal, 1);
          }
          raster.set(i % w, Math.floor(i / w), c[0], c[1], c[2]);
        }
        p.background(...ctx.bg);
        const ox = (ctx.width - w * cell) / 2;
        const oy = (ctx.height - h * cell) / 2;
        raster.blit(p, false, ox, oy, w * cell, h * cell);

        const centre = (i: number): [number, number] =>
          [ox + (i % w + 0.5) * cell, oy + (Math.floor(i / w) + 0.5) * cell];
        const route = search?.path() ?? [];
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
        const ends = search ? [[search.start, 'A'], [search.goal, 'B']] as const : [];
        for (const [i, label] of ends) {
          const [x, y] = centre(i);
          p.fill(...ctx.fg);
          p.circle(x, y, cell * 2.2);
          p.fill(...ctx.bg);
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(Math.max(9, cell * 1.3));
          p.text(label, x, y + 0.5);
        }

        if (!search) {
          ctx.stats([
            { label: 'algorithm', value: LABELS[str(params, 'algorithm') as Kind] ?? LABELS.astar },
            { label: 'expanded cells', value: '0' },
            { label: 'path cost', value: 'no map found' },
            { label: 'vs optimum', value: 'no map found' },
            pacer.row(params),
          ]);
          return;
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
