// The plate of a deterministic, deliberately slow recursive sort (stooge sort, slowsort): the
// kernel's algorithm, mirrored with an explicit call stack, runs a bounded number of kernel steps
// per frame and counts its comparisons as they happen, while the chart sets them against
//   - the wasm kernel itself, run count-only for every n up to the chosen one (one n per frame,
//     only where a run fits a frame), so the curve is measured by the compiled kernel,
//   - the exact recurrence of the algorithm's comparisons (theory, computed from the definition),
//   - a reference power of n (the master theorem's exponent, or a fit to the small sizes),
// with this run's own count rising at its n. The comparisons never depend on the keys; the swaps
// do, and the readouts set the mirror's against the kernel's on the same input. The `runs`
// control stops the plate after k completed runs (../settle/settle.ts), holding the k-th.
import type p5 from 'p5';
import { paletteParam, ramp } from '../../../core/palette';
import { num, type PlateCode, type PlateContext } from '../../../core/plate';
import { caption, drawBars, padding, slotWidth, type Box } from '../bars/bars';
import { STEP_PACE, stepPaceParam, stepPacer } from '../kernel-mirror/controls';
import type { Stepper } from '../kernel-mirror/tracer';
import { countOnly, sortingNow, type WasmRun } from '../kernel-mirror/wasm';
import { chartOf, fmt, Series } from '../live-chart/series';
import { RunCounter, runsParam } from '../settle/settle';
import { input, isSorted, runSeed, SHAPES, shapeOf, shapeParam } from '../sort-input/input';

/** Where the recursion stands: the call being worked on and the calls still waiting. */
export interface CallState {
  i: number;
  j: number;
  depth: number;
  maxDepth: number;
  /** Pending tasks as [i, j, depth] triples, oldest first (the explicit stack); a task that is
   * not a call carries a negative depth. */
  pending: number[];
}

export interface ScalingRun {
  keys: number[];
  stepper: Stepper;
  calls: CallState;
}

export interface ScalingSpec {
  id: string;
  /** The wasm kernel id this plate mirrors. */
  kernel: string;
  n: { min: number; max: number; value: number };
  start(keys: number[], seed: number): ScalingRun;
  /** Exact comparisons on n keys, from the algorithm's recurrence. */
  recurrence(n: number): number;
  /** The reference power line: its name and its points over 2..n, given the measured points. */
  reference(n: number, measured: readonly [number, number][]): { name: string; points: [number, number][] };
  /** Readouts after the shared ones. */
  growth(n: number, measured: readonly [number, number][]): { label: string; value: string }[];
}

/** The largest comparison count the plate asks the wasm kernel for within one frame. */
export const SWEEP_CAP = 400_000;
const HOLD = 60;

export function scalingPlate(spec: ScalingSpec): PlateCode {
  return {
    id: spec.id,
    mode: '2d',
    aspect: 16 / 10,
    thumbnailFrames: 40,
    params: [
      { kind: 'range', key: 'n', label: 'Keys n', min: spec.n.min, max: spec.n.max, step: 1,
        value: spec.n.value, rebuild: true },
      shapeParam(SHAPES, 'random'),
      runsParam(),
      stepPaceParam(),
      paletteParam('spectral'),
    ],
    pace: STEP_PACE,
    create(p, ctx) {
      const params = ctx.params;
      const pacer = stepPacer();
      const n = num(params, 'n');
      const shape = shapeOf(params.shape);
      let k = 0;
      let run: ScalingRun;
      let kernelOnInput: WasmRun | undefined;
      let hold = 0;
      let sweepN = 2;
      const completed = new RunCounter(params);
      const kernel = new Series(`${spec.kernel} kernel (wasm), measured`);
      const theory = new Series('exact recurrence (theory)');
      for (let m = 2; m <= n; m++) theory.push(m, spec.recurrence(m));

      const inputOf = (r: number) => input(shape, n, runSeed(ctx.seed, r));
      const next = () => {
        run = spec.start(inputOf(k), runSeed(ctx.seed, k));
        kernelOnInput = undefined;
      };

      const sweep = () => {
        // one size per frame, measured by the compiled kernel on this plate's input shape
        const s = sortingNow();
        if (!s || ctx.thumbnail) return;
        if (!kernelOnInput && spec.recurrence(n) <= SWEEP_CAP) {
          kernelOnInput = countOnly(s, spec.kernel, inputOf(k), { seed: runSeed(ctx.seed, k) });
          return;
        }
        if (sweepN > n) return;
        if (spec.recurrence(sweepN) <= SWEEP_CAP) {
          const r = countOnly(s, spec.kernel, input(shape, sweepN, runSeed(ctx.seed, 1000 + sweepN)));
          if (r.outcome === 'sorted') kernel.push(sweepN, r.counts.cmp);
        }
        sweepN++;
      };

      return {
        pace: () => pacer.report(completed.stopped, params),
        setup() {
          p.textFont('monospace');
          next();
        },
        draw() {
          if (hold > 0) {
            hold--;
            if (hold === 0) {
              k++;
              next();
            }
          } else if (run.stepper.done) {
            // held on its k-th completed run; a raised limit lets the next run start
            if (!completed.stopped) {
              k++;
              next();
            }
          } else {
            run.stepper.advance(ctx.thumbnail ? 64 : pacer.take(params));
            if (run.stepper.done) {
              const c = run.stepper.t.counts;
              const sorted = run.stepper.outcome === 'sorted' && isSorted(run.keys);
              completed.complete(`${fmt(c.cmp)} comparisons, ${fmt(c.swap)} swaps, `
                + (sorted ? 'ascending (checked)' : `NOT sorted (${run.stepper.outcome})`));
              if (!completed.stopped) hold = ctx.thumbnail ? 1 : HOLD;
            }
          }
          sweep();
          render();
          publish();
        },
      };

      function render() {
        const pad = padding(ctx.width);
        const pal = ctx.palette();
        p.background(...ctx.bg);
        const band = Math.round(ctx.height * 0.22);
        const top = pad + 20;
        const bars: Box = { x: pad, y: top, w: ctx.width - 2 * pad, h: ctx.height - top - band - pad - 10 };
        const c = run.calls;
        const cw = slotWidth(bars, n);
        if (!run.stepper.done && c.j >= c.i) {
          p.noStroke();
          p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 26);
          p.rect(bars.x + c.i * cw, bars.y, (c.j - c.i + 1) * cw, bars.h);
        }
        const t = run.stepper.t;
        drawBars(p, bars, {
          keys: run.keys, max: n, fg: ctx.fg,
          touched: run.stepper.done || t.last.op === 'none' ? [] : [t.last.i, t.last.j],
          color: (i) => ramp(pal, n > 1 ? (run.keys[i] - 1) / (n - 1) : 0.5),
        });
        callBand(p, ctx, { x: pad, y: ctx.height - band - pad + 4, w: bars.w, h: band - 4 }, run.calls, cw);
        caption(p, ctx.fg, `run ${k + 1} · ${fmt(t.counts.cmp)} of ${fmt(spec.recurrence(n))} comparisons`
          + (run.stepper.done ? ` · ${run.stepper.outcome}` : ''), pad, pad, Math.max(10, Math.min(13, ctx.width / 52)));
      }

      function publish() {
        const t = run.stepper.t;
        const want = spec.recurrence(n);
        const done = run.stepper.done;
        const rows = [
          { label: 'comparisons, counted live', value: `${fmt(t.counts.cmp)} of ${fmt(want)} (${fmt((100 * t.counts.cmp) / Math.max(1, want), 1)} %)` },
          { label: 'swaps, counted live', value: fmt(t.counts.swap) },
          { label: 'recursion', value: `depth ${fmt(run.calls.depth)} (deepest ${fmt(run.calls.maxDepth)}), ${fmt(waiting(run.calls))} calls waiting` },
          { label: 'kernel (wasm) on this input', value: kernelOnInput
            ? `${fmt(kernelOnInput.counts.cmp)} comparisons, ${fmt(kernelOnInput.counts.swap)} swaps`
            : want > SWEEP_CAP ? 'not run: more comparisons than one frame affords' : 'loading' },
          ...spec.growth(n, kernel.points),
        ];
        if (done) {
          rows.push({ label: 'result', value: run.stepper.outcome === 'sorted' && isSorted(run.keys)
            ? 'ascending, verified' : `NOT sorted (${run.stepper.outcome})` });
        }
        ctx.stats([...rows, ...completed.rows(), pacer.row(params)]);
        const live = new Series('this run, counted live');
        live.push(n, 1);
        live.push(n, Math.max(1, t.counts.cmp));
        const ref = spec.reference(n, kernel.points);
        const refSeries = new Series(ref.name);
        for (const [x, y] of ref.points) refSeries.push(x, y);
        ctx.chart(chartOf('Comparisons as n grows', { label: 'keys n', log: true },
          { label: 'comparisons', log: true }, [kernel, theory, refSeries, live]));
      }
    },
  };
}

/** Calls on the stack (entries of depth ≥ 0; other tasks carry a negative depth). */
export function waiting(c: CallState): number {
  let w = 0;
  for (let s = 2; s < c.pending.length; s += 3) if (c.pending[s] >= 0) w++;
  return w;
}

/** The call stack under the bars: each waiting call as a line over its range, by depth. */
function callBand(p: p5, ctx: PlateContext, box: Box, c: CallState, cw: number): void {
  const rows = Math.max(4, c.maxDepth + 1);
  const rh = box.h / rows;
  const pal = ctx.palette();
  p.noStroke();
  for (let s = 0; s < c.pending.length; s += 3) {
    const [i, j, d] = [c.pending[s], c.pending[s + 1], c.pending[s + 2]];
    if (d < 0) continue; // a task that is not a call (slowsort's compare-and-swap)
    const col = ramp(pal, rows > 1 ? d / (rows - 1) : 0);
    p.fill(col[0], col[1], col[2], 150);
    p.rect(box.x + i * cw, box.y + d * rh, Math.max(1, (j - i + 1) * cw), Math.max(1, rh * 0.7));
  }
  if (c.j >= c.i) {
    p.fill(...ctx.fg);
    p.rect(box.x + c.i * cw, box.y + c.depth * rh, Math.max(1, (c.j - c.i + 1) * cw), Math.max(1.5, rh * 0.7));
  }
  caption(p, ctx.fg, 'calls waiting on the stack, by depth; solid: the call running now',
    box.x, box.y + box.h - 12, Math.max(9, Math.min(11, ctx.width / 66)), 'left', 150);
}
