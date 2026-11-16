import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import { HOLD_FRAMES, Pacer, paceParam } from '../../core/pace';
import { DEFAULT_MODEL, path, Rng, type Model, type Sample } from './motion';

/** Targets one run points at, in turn. */
export const MOVES = 40;

interface Move { from: [number, number]; to: [number, number]; width: number; samples: Sample[]; id: number; ms: number }

/** The least-squares line through (x, y) points: [intercept, slope]. */
export function fit(xs: number[], ys: number[]): [number, number] {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n; const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0; let sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxx > 0 ? sxy / sxx : 0;
  return [my - b * mx, b];
}

/** A run's moves: MOVES targets placed by the seed, each pointed at from the last, in one seeded session. */
export function moves(width: number, height: number, seed: number, model: Model, target: number): Move[] {
  const place = mulberry32(seed);
  const rng = new Rng(seed);
  const out: Move[] = [];
  let at: [number, number] = [Math.round(width / 2), Math.round(height / 2)];
  for (let i = 0; i < MOVES; i++) {
    const w = Math.round(target * (0.4 + 1.2 * place()));
    const to: [number, number] = [Math.round(w + place() * (width - 2 * w)), Math.round(w + place() * (height - 2 * w))];
    const samples = path(model, at, to, w, rng);
    const d = Math.hypot(to[0] - at[0], to[1] - at[1]);
    out.push({ from: at, to, width: w, samples, id: Math.log2(d / Math.max(w, 4) + 1), ms: samples.reduce((s, q) => s + q[2], 0) });
    at = to;
  }
  return out;
}

export const humanPointing: PlateCode = {
  id: 'human-pointing',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 200,
  params: [
    { kind: 'range', key: 'target', label: 'Target width (px)', min: 8, max: 120, step: 2, value: 40, rebuild: true },
    { kind: 'range', key: 'fitts_b', label: "Fitts' slope (s per bit)", min: 0.02, max: 0.4, step: 0.01, value: DEFAULT_MODEL.fitts_b, rebuild: true },
    { kind: 'range', key: 'curvature', label: 'Bow of the path', min: 0, max: 0.4, step: 0.01, value: DEFAULT_MODEL.curvature, rebuild: true },
    { kind: 'range', key: 'tremor', label: 'Tremor (px)', min: 0, max: 6, step: 0.1, value: DEFAULT_MODEL.tremor, rebuild: true },
    { kind: 'range', key: 'overshoot_from', label: 'Overshoot beyond (px)', min: 0, max: 2000, step: 20, value: DEFAULT_MODEL.overshoot_from, rebuild: true },
    { kind: 'range', key: 'speed', label: 'Speed', min: 0.25, max: 4, step: 0.25, value: DEFAULT_MODEL.speed, rebuild: true },
    paceParam(),
    { kind: 'toggle', key: 'loop', label: 'New targets when done', value: true },
    paletteParam('ember'),
  ],
  pace: { kind: 'replay', unit: 'samples' },
  create(p, ctx) {
    const params = ctx.params;
    const pacer = new Pacer('replay', 'samples', 3);
    let run: Move[] = [];
    let total = 0;
    let shown = 0;
    let hold = 0;
    let generation = 0;

    function build() {
      const model: Model = { ...DEFAULT_MODEL, fitts_b: num(params, 'fitts_b'), curvature: num(params, 'curvature'), tremor: num(params, 'tremor'),
        overshoot_from: num(params, 'overshoot_from'), speed: num(params, 'speed') };
      run = moves(ctx.width, ctx.height, ctx.seed + generation * 104729, model, num(params, 'target'));
      total = run.reduce((s, m) => s + m.samples.length, 0);
      shown = 0; hold = 0;
      pacer.start(total);
    }

    return {
      pace: () => pacer.report(shown >= total, params),
      setup() { build(); },
      draw() {
        const done = shown >= total;
        shown = Math.min(total, shown + (ctx.thumbnail ? 6 : done ? 0 : pacer.take(params)));
        if (done) {
          hold++;
          if (bool(params, 'loop') && hold > HOLD_FRAMES && !ctx.thumbnail) { generation++; build(); }
        }
        const pal = ctx.palette();
        p.background(...ctx.bg);
        // which move is under way, and how many of its samples are drawn
        let left = shown; let k = 0;
        while (k < run.length - 1 && left > run[k].samples.length) { left -= run[k].samples.length; k++; }
        const finished = run.slice(0, k).concat(left >= run[k].samples.length ? [run[k]] : []);
        p.noStroke();
        for (let i = Math.max(0, k - 6); i < k; i++) {
          const m = run[i];
          p.fill(...mix(ctx.bg, ramp(pal, 0.3), 0.5));
          for (const [x, y] of m.samples) p.circle(x, y, 2.5);
        }
        const cur = run[k];
        p.noFill(); p.stroke(...ramp(pal, 0.85)); p.strokeWeight(2);
        p.circle(cur.to[0], cur.to[1], cur.width);
        p.noStroke();
        const n = Math.min(left, cur.samples.length);
        for (let i = 0; i < n; i++) {
          const [x, y] = cur.samples[i];
          p.fill(...ramp(pal, 0.35 + (0.6 * i) / Math.max(1, cur.samples.length)));
          p.circle(x, y, 4);
        }
        const [px, py] = n > 0 ? cur.samples[n - 1] : cur.from;
        p.fill(...ctx.fg);
        p.triangle(px, py, px + 4, py + 13, px + 10, py + 9);
        const ids = finished.map((m) => m.id); const ms = finished.map((m) => m.ms);
        const [a, b] = finished.length >= 2 ? fit(ids, ms) : [NaN, NaN];
        const endError = finished.reduce((e, m) => Math.max(e, Math.hypot(m.samples[m.samples.length - 1][0] - m.to[0], m.samples[m.samples.length - 1][1] - m.to[1])), 0);
        const over = finished.filter((m) => {
          const dx = m.to[0] - m.from[0]; const dy = m.to[1] - m.from[1]; const d2 = dx * dx + dy * dy;
          return m.samples.some(([x, y]) => ((x - m.from[0]) * dx + (y - m.from[1]) * dy) / d2 > 1 + 2 / Math.sqrt(d2));
        }).length;
        ctx.stats([
          { label: 'moves', value: `${finished.length} of ${run.length}` },
          { label: 'mean time', value: finished.length ? `${(ms.reduce((s, v) => s + v, 0) / finished.length).toFixed(0)} ms` : '—' },
          { label: "Fitts' slope", value: Number.isFinite(b) ? `${b.toFixed(1)} ms per bit` : '—' },
          { label: "Fitts' intercept", value: Number.isFinite(a) ? `${a.toFixed(1)} ms` : '—' },
          { label: 'overshoots', value: String(over) },
          { label: 'end error', value: `${endError.toFixed(1)} px` },
          { label: 'samples', value: shown.toLocaleString('en') },
          pacer.row(params),
        ]);
      },
    };
  },
};

export default humanPointing;
