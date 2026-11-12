import { paletteParam, ramp, scale } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import { Raster } from '../../core/raster';
import { bounded, cellWithin } from '../../core/budget';

/** Pixels labelled per frame at most: the pixel size is raised to fit (src/core/budget.ts). */
export const MAX_PIXELS = 80_000;

interface Site {
  x: number;
  y: number;
  hue: number;
}

/** Nearest-site labelling of a w×h grid using a bucket grid searched ring by ring (exact). */
export function label(sites: Site[], w: number, h: number, owner: Int32Array, d2: Float32Array): void {
  const size = Math.max(4, Math.sqrt((w * h) / Math.max(1, sites.length)));
  const bw = Math.ceil(w / size);
  const bh = Math.ceil(h / size);
  const buckets: number[][] = Array.from({ length: bw * bh }, () => []);
  sites.forEach((s, i) => {
    const bx = Math.min(bw - 1, Math.max(0, Math.floor(s.x / size)));
    const by = Math.min(bh - 1, Math.max(0, Math.floor(s.y / size)));
    buckets[by * bw + bx].push(i);
  });
  for (let y = 0; y < h; y++) {
    const by = Math.min(bh - 1, Math.floor(y / size));
    for (let x = 0; x < w; x++) {
      const bx = Math.min(bw - 1, Math.floor(x / size));
      let best = -1;
      let bestD = Infinity;
      for (let r = 0; r < Math.max(bw, bh); r++) {
        // every site in ring r+1 or beyond is at least r·size away
        if (best >= 0 && bestD <= (r - 1) * size * ((r - 1) * size)) break;
        for (let yy = by - r; yy <= by + r; yy++) {
          if (yy < 0 || yy >= bh) continue;
          for (let xx = bx - r; xx <= bx + r; xx++) {
            if (xx < 0 || xx >= bw) continue;
            if (Math.max(Math.abs(xx - bx), Math.abs(yy - by)) !== r) continue;
            for (const i of buckets[yy * bw + xx]) {
              const dx = sites[i].x - x;
              const dy = sites[i].y - y;
              const dd = dx * dx + dy * dy;
              if (dd < bestD) {
                bestD = dd;
                best = i;
              }
            }
          }
        }
      }
      owner[y * w + x] = best;
      d2[y * w + x] = bestD;
    }
  }
}

type Stop = '' | 'settled' | 'budget';

/** Why the relaxation stopped, or that it has not; the first number is the steps taken. */
function stopReadout(stopped: Stop, k: number, steps: number, shift: number): string {
  const largest = Number.isFinite(shift) ? `, largest shift ${shift.toFixed(3)} px` : '';
  if (stopped === 'settled') return `settled: largest shift below ε after ${steps} steps${largest}`;
  if (stopped === 'budget') return `step budget reached: ${steps} steps${largest}`;
  if (k <= 0) return 'paused: relaxation per frame is 0';
  return `not yet: ${steps} steps${largest}`;
}

export const voronoiRelax: PlateCode = {
  id: 'voronoi-relax',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 24,
  params: [
    { kind: 'range', key: 'sites', label: 'Seeds', min: 8, max: 400, step: 1, value: 120,
      rebuild: true },
    { kind: 'range', key: 'relax', label: 'Relaxation per frame', min: 0, max: 1, step: 0.01,
      value: 0.08 },
    // the relaxation stops at whichever comes first, so its readouts settle (ADR 0007)
    { kind: 'range', key: 'epsilon', label: 'Stop below largest shift ε (px)', min: 0.001, max: 1,
      step: 0.001, value: 0.05 },
    { kind: 'range', key: 'budget', label: 'Step budget, then stop', min: 10, max: 10_000, step: 10,
      value: 5_000 },
    { kind: 'range', key: 'res', label: 'Pixel size', min: 1, max: 6, step: 1, value: 3,
      rebuild: true },
    { kind: 'toggle', key: 'seeds', label: 'Show seeds', value: true },
    { kind: 'toggle', key: 'leading', label: 'Lead between panes', value: true },
    paletteParam('riso'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let sites: Site[] = [];
    let raster: Raster;
    let owner: Int32Array;
    let d2: Float32Array;
    let res = 3;
    let iteration = 0;
    // steps since the last (re)start: setup or a click, which resumes the relaxation
    let steps = 0;
    let shift = Infinity;
    let startEnergy = NaN;

    const add = (x: number, y: number) => sites.push({ x, y, hue: ctx.rnd() });

    return {
      setup() {
        res = cellWithin(ctx.width, ctx.height, num(params, 'res'), MAX_PIXELS);
        raster = new Raster(ctx.width / res, ctx.height / res);
        owner = new Int32Array(raster.w * raster.h);
        d2 = new Float32Array(raster.w * raster.h);
        sites = [];
        const n = num(params, 'sites');
        // clustered start: the relaxation has visible work to do
        for (let i = 0; i < n; i++) {
          const cx = raster.w * (0.3 + 0.4 * ctx.rnd());
          const cy = raster.h * (0.3 + 0.4 * ctx.rnd());
          const r = Math.min(raster.w, raster.h) * 0.45 * Math.pow(ctx.rnd(), 1.5);
          const a = ctx.rnd() * Math.PI * 2;
          add(Math.min(raster.w - 1, Math.max(0, cx + Math.cos(a) * r)),
            Math.min(raster.h - 1, Math.max(0, cy + Math.sin(a) * r)));
        }
        iteration = 0;
        steps = 0;
        shift = Infinity;
        startEnergy = NaN;
      },
      pressed(x, y) {
        add(x / res, y / res);
        steps = 0;
        shift = Infinity;
      },
      draw() {
        const w = raster.w;
        const h = raster.h;
        label(sites, w, h, owner, d2);

        const sx = new Float64Array(sites.length);
        const sy = new Float64Array(sites.length);
        const cnt = new Float64Array(sites.length);
        const far = new Float64Array(sites.length);
        let energy = 0;
        for (let i = 0; i < owner.length; i++) {
          const o = owner[i];
          sx[o] += i % w;
          sy[o] += Math.floor(i / w);
          cnt[o]++;
          if (d2[i] > far[o]) far[o] = d2[i];
          energy += d2[i];
        }

        const pal = ctx.palette();
        const lead = bool(params, 'leading');
        const colours = sites.map((s) => ramp(pal, s.hue));
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const o = owner[i];
            const edge = lead && ((x + 1 < w && owner[i + 1] !== o) || (y + 1 < h && owner[i + w] !== o));
            if (edge) {
              raster.set(x, y, ctx.bg[0], ctx.bg[1], ctx.bg[2]);
              continue;
            }
            // cushion shading: brighter at the seed, darker towards the cell's farthest pixel
            const t = far[o] > 0 ? Math.sqrt(d2[i] / far[o]) : 0;
            const c = scale(colours[o], 1.08 - 0.5 * t * t);
            raster.set(x, y, c[0], c[1], c[2]);
          }
        }
        p.background(...ctx.bg);
        raster.blit(p, true);

        const meanEnergy = (energy / owner.length) * res * res;
        if (Number.isNaN(startEnergy)) startEnergy = meanEnergy;

        // one Lloyd step unless stopped: the step's largest seed shift fell below ε (in canvas
        // pixels) or the step budget is spent, whichever came first. Judged every frame, so a
        // smaller ε or a larger budget set after the stop resumes the relaxation.
        const k = num(params, 'relax');
        const cause = (): Stop => shift < num(params, 'epsilon') ? 'settled'
          : steps >= num(params, 'budget') ? 'budget' : '';
        let stopped = cause();
        if (!stopped && k > 0) {
          let worst = 0;
          for (let i = 0; i < sites.length; i++) {
            if (!cnt[i]) continue;
            const dx = (sx[i] / cnt[i] - sites[i].x) * k;
            const dy = (sy[i] / cnt[i] - sites[i].y) * k;
            sites[i].x += dx;
            sites[i].y += dy;
            const d = dx * dx + dy * dy;
            if (d > worst) worst = d;
          }
          shift = Math.sqrt(worst) * res;
          iteration++;
          steps++;
          stopped = cause();
        }

        if (bool(params, 'seeds')) {
          p.noStroke();
          p.fill(...ctx.fg);
          for (const s of sites) p.circle(s.x * res, s.y * res, 3);
        }
        ctx.stats([
          { label: 'seeds', value: String(sites.length) },
          { label: 'Lloyd iterations', value: String(iteration) },
          { label: 'Stopped', value: stopReadout(stopped, k, steps, shift) },
          { label: 'quantisation energy, start → now',
            value: `${startEnergy.toFixed(1)} → ${meanEnergy.toFixed(1)} px²` },
          { label: 'labelled pixels', value: `${w}×${h}, pixel size ${bounded(res, num(params, 'res'), ' px')}` },
        ]);
      },
    };
  },
};

export default voronoiRelax;
