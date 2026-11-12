// Burnt pancake sort: a stack of pancakes, each with a burnt side drawn dark, flipped by the
// spatula until it is in order with every burnt side down. The flips of each stack are counted
// and charted against the simple method's own bound, 3n, and the bounds on the best method that
// Gates and Papadimitriou proved (the catalogue entry cites them). The `runs` control stops the
// plate after k completed stacks (../_shared/settle/settle.ts).
import type p5 from 'p5';
import { paletteParam, ramp, scale, type RGB } from '../../core/palette';
import { num, str, type PlateCode, type PlateContext } from '../../core/plate';
import { caption, padding, type Box } from '../_shared/bars/bars';
import { STEP_PACE, stepPaceParam, stepPacer } from '../_shared/kernel-mirror/controls';
import { chartOf, fmt, Series } from '../_shared/live-chart/series';
import { RunCounter, runsParam } from '../_shared/settle/settle';
import { DISTINCT, input, isSorted, runSeed, shapeOf, shapeParam } from '../_shared/sort-input/input';
import { countUp, isUp, pancakeRun, type Orientation, type PancakeRun } from './pancake';

const HOLD = 60;

const orientation = (v: unknown): Orientation => (v === 'up' || v === 'down' ? v : 'random');

const burntPancakeSort: PlateCode = {
  id: 'burnt-pancake-sort',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 60,
  params: [
    { kind: 'range', key: 'n', label: 'Pancakes n', min: 2, max: 40, step: 1, value: 12, rebuild: true },
    shapeParam(DISTINCT, 'random'),
    {
      kind: 'select', key: 'orient', label: 'Burnt sides at the start', value: 'random', rebuild: true,
      options: [
        { value: 'random', label: 'Random (the kernel draws them)' },
        { value: 'up', label: 'All burnt side up' },
        { value: 'down', label: 'All burnt side down' },
      ],
    },
    runsParam(),
    stepPaceParam(),
    paletteParam('ember'),
  ],
  pace: STEP_PACE,
  create(p, ctx) {
    const params = ctx.params;
    const pacer = stepPacer();
    const n = num(params, 'n');
    const shape = shapeOf(params.shape, DISTINCT);
    const orient = orientation(str(params, 'orient'));
    let k = 0;
    let run: PancakeRun;
    let hold = 0;
    let flipsSum = 0;
    const completed = new RunCounter(params);
    const measured = new Series('flips per stack (counted)');
    const mean = new Series('mean flips per stack');
    const simple = new Series('3n: the simple method never needs more');
    const gpUpper = new Series('2n + 3: enough for any stack (Gates–Papadimitriou)');
    const gpLower = new Series('3n/2 − 1: some stack needs this many (Gates–Papadimitriou)');

    const next = () => {
      run = pancakeRun(input(shape, n, runSeed(ctx.seed, k)), runSeed(ctx.seed, k), orient);
    };

    const finish = () => {
      flipsSum += run.state.flips;
      const ok = run.stepper.outcome === 'sorted' && isSorted(run.a.key) && countUp(run.a) === 0;
      completed.complete(`${fmt(run.state.flips)} flips, `
        + (ok ? 'in order, every burnt side down (checked)' : 'NOT sorted'));
      const stacks = completed.count;
      measured.push(stacks, run.state.flips);
      mean.push(stacks, flipsSum / stacks);
      for (const [s, v] of [[simple, 3 * n], [gpUpper, 2 * n + 3], [gpLower, 1.5 * n - 1]] as const) {
        s.clear();
        s.push(1, v);
        s.push(Math.max(2, stacks), v);
      }
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
          // held on its k-th completed stack; a raised limit lets the next stack start
          if (!completed.stopped) {
            k++;
            next();
          }
        } else {
          run.stepper.advance(ctx.thumbnail ? 4 : pacer.take(params));
          if (run.stepper.done) {
            finish();
            if (!completed.stopped) hold = ctx.thumbnail ? 1 : HOLD;
          }
        }
        render();
        publish();
      },
    };

    function render() {
      const pad = padding(ctx.width);
      p.background(...ctx.bg);
      const top = pad + 22;
      const box: Box = { x: pad, y: top, w: ctx.width - 2 * pad, h: ctx.height - top - pad };
      drawStack(p, ctx, box, run, n);
      const size = Math.max(10, Math.min(13, ctx.width / 52));
      const st = run.state;
      caption(p, ctx.fg, `stack ${k + 1} · ${fmt(st.flips)} flips${st.flipping ? ` · flipping the top ${st.flipping}` : ''}`
        + `${run.stepper.done ? ' · sorted, burnt sides down' : ''}`, pad, pad, size);
    }

    function publish() {
      const t = run.stepper.t;
      const st = run.state;
      const stacks = completed.count;
      ctx.stats([
        { label: 'flips, this stack', value: `${fmt(st.flips)} (the simple method's bound: 3n = ${fmt(3 * n)})` },
        { label: 'burnt sides up now / at the start', value: `${fmt(countUp(run.a))} / ${fmt(st.upAtStart)}` },
        { label: 'comparisons, swaps, turns', value: `${fmt(t.counts.cmp)}, ${fmt(t.counts.swap)}, ${fmt(t.counts.write)}` },
        ...completed.rows(),
        { label: 'mean flips per stack', value: stacks ? fmt(flipsSum / stacks, 2) : '–' },
        pacer.row(params),
      ]);
      ctx.chart(chartOf('Flips per stack against the bounds', { label: 'stacks sorted' }, { label: 'flips' },
        [measured, mean, simple, gpUpper, gpLower]));
    }
  },
};

/** The stack, top pancake first; each pancake's burnt side is a dark band on that face. */
function drawStack(p: p5, ctx: PlateContext, box: Box, run: PancakeRun, n: number): void {
  const pal = ctx.palette();
  const a = run.a;
  const slot = box.h / n;
  const th = Math.max(3, Math.min(30, slot * 0.78));
  const burnt = Math.max(1.5, th * 0.32);
  const cx = box.x + box.w / 2;
  const unit = (box.w * 0.82) / n;
  const flipping = run.state.flipping;
  p.noStroke();
  for (let i = 0; i < n; i++) {
    const key = a.key[i];
    const w = Math.max(6, key * unit);
    const y = box.y + i * slot + (slot - th) / 2;
    const c: RGB = ramp(pal, 0.15 + 0.75 * ((key - 1) / Math.max(1, n - 1)));
    p.fill(c[0], c[1], c[2], flipping && i < flipping ? 255 : 230);
    p.rect(cx - w / 2, y, w, th, Math.min(th / 2, 8));
    const d = scale(c, 0.32);
    p.fill(d[0], d[1], d[2]);
    if (isUp(a.tag[i])) p.rect(cx - w / 2, y, w, burnt, Math.min(burnt, 4));
    else p.rect(cx - w / 2, y + th - burnt, w, burnt, Math.min(burnt, 4));
  }
  if (flipping) {
    // the spatula under the k-th pancake from the top
    const y = box.y + flipping * slot - 1;
    p.fill(...ctx.fg);
    p.rect(box.x, y - 1.5, box.w * 0.09 + 6, 3, 2);
    p.rect(box.x + box.w * 0.09 + 6, y - 5, 3, 8, 1);
  }
}

export default burntPancakeSort;
