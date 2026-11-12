// The plate of a randomised sort whose expected work is factorial (bogosort, bozosort,
// bogobogosort): the kernel's own algorithm, mirrored step by step, runs on a small seeded input
// a bounded number of kernel steps per frame; every finished run adds its measured attempts to
// a running mean that is drawn, live, next to the mean theory expects for the same inputs. Runs
// follow one another (run k uses runSeed(seed, k) for its input and its generator), several in
// one frame when they are short, so the mean converges while the reader watches.
import type p5 from 'p5';
import { paletteParam, ramp, type RGB } from '../../../core/palette';
import { num, type ParamDef, type Params, type PlateCode, type PlateContext, type Stat } from '../../../core/plate';
import { caption, drawBars, padding, type Box } from '../bars/bars';
import { speedOf, speedParam } from '../kernel-mirror/controls';
import type { Stepper } from '../kernel-mirror/tracer';
import { chartOf, fmt, Trials } from '../live-chart/series';
import { input, runSeed, shapeOf, shapeParam, type Shape } from '../sort-input/input';

/** One run of the algorithm on one input. */
export interface TrialRun {
  readonly keys: number[];
  readonly stepper: Stepper;
  /** What one attempt is counted as so far (shuffles, swaps): measured, never estimated. */
  attempts(): number;
  /** What theory expects `attempts()` to reach on this input. */
  readonly expected: number;
}

export interface TrialSpec<R extends TrialRun> {
  id: string;
  /** The n control: the range in which a run finishes in seconds, not years. */
  n: { min: number; max: number; value: number };
  shapes: readonly Shape[];
  /** Plate-specific controls (variants), placed after n and the input. */
  extra?: ParamDef[];
  /** Plural noun of an attempt, for readouts and the chart's y axis. */
  attempts: string;
  /** Name of the theory series in the chart and its readout (it may depend on a variant). */
  theory: string | ((params: Params) => string);
  start(keys: number[], seed: number, ctx: PlateContext): R;
  /** Readouts after the shared ones. */
  stats?(run: R, ctx: PlateContext): Stat[];
  /** Drawing under the bars (the lower band of the canvas). */
  drawBand?(p: p5, ctx: PlateContext, box: Box, run: R): void;
  /** Colour of bar i (default: the palette ramp by key). */
  color?(run: R, i: number, pal: (t: number) => RGB, ctx: PlateContext): RGB;
}

/** Frames a finished run stays on screen when it took long enough to be watched. */
const HOLD = 40;
/** Runs started in one frame at most: short runs at a high speed share the frame's steps. */
const RUNS_PER_FRAME = 256;

export function trialPlate<R extends TrialRun>(spec: TrialSpec<R>): PlateCode {
  return {
    id: spec.id,
    mode: '2d',
    aspect: 16 / 10,
    thumbnailFrames: 30,
    params: [
      { kind: 'range', key: 'n', label: 'Keys n', min: spec.n.min, max: spec.n.max, step: 1,
        value: spec.n.value, rebuild: true },
      shapeParam(spec.shapes, spec.shapes[0]),
      ...(spec.extra ?? []),
      speedParam(16),
      paletteParam('spectral'),
    ],
    create(p, ctx) {
      const params = ctx.params;
      const theory = typeof spec.theory === 'string' ? spec.theory : spec.theory(params);
      const trials = new Trials(`mean ${spec.attempts} per run (measured)`, theory);
      let k = 0;
      let run: R;
      let frames = 0;
      let hold = 0;
      let doneSteps = { cmp: 0, swap: 0 };

      const next = () => {
        const n = num(params, 'n');
        const seed = runSeed(ctx.seed, k);
        run = spec.start(input(shapeOf(params.shape, spec.shapes), n, seed), seed, ctx);
        frames = 0;
      };

      const finish = () => {
        trials.add(run.attempts(), run.expected);
        doneSteps = { cmp: doneSteps.cmp + run.stepper.t.counts.cmp, swap: doneSteps.swap + run.stepper.t.counts.swap };
        k++;
      };

      return {
        setup() {
          p.textFont('monospace');
          next();
        },
        draw() {
          let budget = speedOf(params);
          if (hold > 0) {
            hold--;
            if (hold === 0) next();
          } else {
            frames++;
            for (let r = 0; r < RUNS_PER_FRAME && budget > 0; r++) {
              const before = run.stepper.t.steps;
              run.stepper.advance(budget);
              budget -= Math.max(1, run.stepper.t.steps - before);
              if (!run.stepper.done) break;
              finish();
              // a run the reader could watch stays on screen; a run over within a frame does not
              if (frames > 2 && !ctx.thumbnail) {
                hold = HOLD;
                break;
              }
              next();
            }
          }
          render();
          publish();
        },
      };

      function render() {
        const pad = padding(ctx.width);
        const pal = ctx.palette();
        p.background(...ctx.bg);
        const band = spec.drawBand ? Math.round(ctx.height * 0.26) : 0;
        const top = pad + 20;
        const bars: Box = { x: pad, y: top, w: ctx.width - 2 * pad, h: ctx.height - top - band - pad - 10 };
        const t = run.stepper.t;
        const touched = t.last.op === 'none' || run.stepper.done ? [] : [t.last.i, t.last.j];
        const max = Math.max(1, ...run.keys);
        drawBars(p, bars, {
          keys: run.keys, max, fg: ctx.fg, touched,
          color: (i) => (spec.color ? spec.color(run, i, (x) => ramp(pal, x), ctx)
            : ramp(pal, max > 1 ? (run.keys[i] - 1) / (max - 1) : 0.5)),
        });
        const status = run.stepper.done ? `run ${k} ${run.stepper.outcome}` : `run ${k + 1}`;
        caption(p, ctx.fg, `${status} · ${fmt(run.attempts())} ${spec.attempts} · expected ${fmt(run.expected, 1)}`,
          pad, pad, Math.max(10, Math.min(13, ctx.width / 52)));
        if (spec.drawBand) {
          spec.drawBand(p, ctx, { x: pad, y: ctx.height - band - pad + 6, w: ctx.width - 2 * pad, h: band - 6 }, run);
        }
      }

      function publish() {
        const t = run.stepper.t;
        const se = trials.stderr;
        ctx.stats([
          { label: 'this run', value: `${fmt(run.attempts())} ${spec.attempts}, ${fmt(t.counts.cmp)} comparisons, ${fmt(t.counts.swap)} swaps` },
          { label: 'expected on this input', value: `${fmt(run.expected, 1)} ${spec.attempts}` },
          { label: 'finished runs', value: fmt(trials.count) },
          { label: `mean ${spec.attempts} per run`, value: trials.count
            ? `${fmt(trials.mean, 1)}${Number.isFinite(se) ? ` ± ${fmt(se, 1)}` : ''}` : '–' },
          { label: theory, value: trials.count ? fmt(trials.expected, 1) : '–' },
          { label: 'all runs', value: `${fmt(doneSteps.cmp + t.counts.cmp)} comparisons, ${fmt(doneSteps.swap + t.counts.swap)} swaps` },
          ...(spec.stats ? spec.stats(run, ctx) : []),
        ]);
        ctx.chart(chartOf(`Measured against expected ${spec.attempts}`,
          { label: 'finished runs' }, { label: `${spec.attempts} per run` }, [trials.measured, trials.theory]));
      }
    },
  };
}
