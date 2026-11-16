// Human pointing on a caller's request (src/core/solve.ts): one movement from `from` to a target
// `width` pixels wide at `to`, seeded, in the model of motion.ts; `drag: true` is the steady
// drag instead. The answer is the samples [x, y, wait_ms] and their total time, the shape the
// OpenTTD fork's player replays, and the same seed gives the same samples as its motion.rs.
import { finite, integer, record, unknownKeys, type DataForm } from '../../core/solve';
import { DEFAULT_MODEL, drag, path, Rng, type Model } from './motion';

/** Coordinates the form takes (pixels, either sign) and the most samples it answers with. */
export const LIMITS = { coord: 100_000, samples: 200_000 };

/** The bounds of each model constant. */
const BOUNDS: Record<keyof Model, [number, number]> = {
  fitts_a: [0, 10], fitts_b: [0, 10], rate_hz: [1, 1000], curvature: [0, 2], overshoot_from: [0, 1e6], tremor: [0, 100], speed: [0.01, 100],
};

const point = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every((c) => integer(c) && Math.abs(c) <= LIMITS.coord);

export const data: DataForm = {
  input: '{from: [x, y], to: [x, y], width (target px), seed (integer >= 0), model?: {fitts_a, fitts_b, rate_hz, curvature, overshoot_from, tremor, speed}, drag?: boolean}',
  solve(raw) {
    if (!record(raw)) return 'the input must be an object {from, to, width, seed, model?, drag?}';
    const extra = unknownKeys(raw, ['from', 'to', 'width', 'seed', 'model', 'drag']);
    if (extra) return extra;
    if (!point(raw.from)) return `from must be [x, y], integers within ±${LIMITS.coord}`;
    if (!point(raw.to)) return `to must be [x, y], integers within ±${LIMITS.coord}`;
    const { width = 40, seed = 1, drag: dragging = false } = raw;
    if (!finite(width) || width <= 0 || width > 1e4) return 'width must be a positive number of pixels, at most 10000';
    if (!integer(seed) || seed < 0) return 'seed must be a non-negative integer';
    if (typeof dragging !== 'boolean') return 'drag must be a boolean';
    const model: Model = { ...DEFAULT_MODEL };
    if (raw.model !== undefined) {
      if (!record(raw.model)) return 'model must be an object';
      const bad = unknownKeys(raw.model, Object.keys(DEFAULT_MODEL));
      if (bad) return `model: ${bad}`;
      for (const [k, v] of Object.entries(raw.model)) {
        const [lo, hi] = BOUNDS[k as keyof Model];
        if (!finite(v) || v < lo || v > hi) return `model.${k} must be a number ${lo}..${hi}`;
        model[k as keyof Model] = v;
      }
    }
    const from = raw.from as [number, number]; const to = raw.to as [number, number];
    // the samples a move makes are bounded by its time: refuse before computing an unbounded answer
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const longest = (dragging ? 0.35 + dist / 900 : model.fitts_a + model.fitts_b * Math.log2(dist / Math.max(width, 4) + 1) + 0.05) * 2 / model.speed;
    if (longest * model.rate_hz > LIMITS.samples) return `the move would take more than ${LIMITS.samples} samples; lower rate_hz or the distance`;
    const rng = new Rng(seed);
    const samples = dragging ? drag(model, from, to, rng) : path(model, from, to, width, rng);
    return { ok: true, samples, duration_ms: samples.reduce((s, q) => s + q[2], 0), model };
  },
};
