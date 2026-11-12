// Stalin sort: the sweep judges each key against the last survivor; the input row shows every
// key's fate, the array row shows the survivors compacted to the front as the kernel writes them.
// The chart follows the survivors along the sweep, this run and the mean of the finished runs,
// against H_i, the expected number of left-to-right maxima among i random distinct keys.
import { mix, paletteParam, ramp } from '../../core/palette';
import { num, type PlateCode } from '../../core/plate';
import { caption, drawBars, padding, slotWidth, type Box } from '../_shared/bars/bars';
import { speedOf, speedParam } from '../_shared/kernel-mirror/controls';
import { chartOf, fmt, Series } from '../_shared/live-chart/series';
import { input, isSorted, runSeed, SHAPES, shapeOf, shapeParam } from '../_shared/sort-input/input';
import { harmonic } from '../_shared/theory/combinatorics';
import { isSubsequence, stalinRun, survivors, type StalinRun } from './stalin';

const HOLD = 60;

const stalinSort: PlateCode = {
  id: 'stalin-sort',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 30,
  params: [
    { kind: 'range', key: 'n', label: 'Keys n', min: 2, max: 512, step: 1, value: 64, rebuild: true },
    shapeParam(SHAPES, 'random'),
    speedParam(4),
    paletteParam('spectral'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    const n = num(params, 'n');
    const shape = shapeOf(params.shape);
    let k = 0;
    let run: StalinRun;
    let hold = 0;
    let runs = 0;
    let keptSum = 0;
    let lastKept = NaN;
    let lastSubsequence = true;
    // survivors after i keys, summed over the finished runs (index i - 1)
    const sumAt = new Float64Array(n);
    let live = new Series('this run, survivors so far (counted)');
    const theory = new Series('H_i: expected for a Random permutation');
    if (shape === 'random') for (let i = 1; i <= n; i++) theory.push(i, harmonic(i));

    const next = () => {
      run = stalinRun(input(shape, n, runSeed(ctx.seed, k)), runSeed(ctx.seed, k));
      live = new Series(live.name);
      live.push(1, 1);
    };

    const finish = () => {
      runs++;
      const s = survivors(run);
      keptSum += s.length;
      lastKept = s.length;
      lastSubsequence = isSubsequence(s, run.input) && isSorted(s);
      let kept = 0;
      for (let i = 0; i < n; i++) {
        if (run.state.fate[i] === 1) kept++;
        sumAt[i] += kept;
      }
    };

    return {
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
        } else {
          const before = run.state.at;
          run.stepper.advance(speedOf(params));
          if (run.state.at !== before || run.stepper.done) live.push(Math.max(1, run.state.at), run.state.kept);
          if (run.stepper.done) {
            finish();
            hold = ctx.thumbnail ? 1 : HOLD;
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
      const top = pad + 20;
      const gap = 18;
      const h = (ctx.height - top - pad - gap) / 2;
      const inBox: Box = { x: pad, y: top, w: ctx.width - 2 * pad, h: h - 8 };
      const outBox: Box = { x: pad, y: top + h + gap, w: inBox.w, h: h - 8 };
      const color = (key: number) => ramp(pal, n > 1 ? (key - 1) / (n - 1) : 0.5);
      const fate = run.state.fate;
      drawBars(p, inBox, {
        keys: run.input, max: n, fg: ctx.fg,
        touched: run.stepper.done ? [] : [run.state.at],
        color: (i) => (fate[i] === -1 ? mix(color(run.input[i]), ctx.bg, 0.78) : color(run.input[i])),
        alpha: (i) => (fate[i] === 0 ? 120 : 255),
      });
      // eliminated keys get a cross through their bar's foot
      const cw = slotWidth(inBox, n);
      p.stroke(ctx.fg[0], ctx.fg[1], ctx.fg[2], 150);
      p.strokeWeight(1);
      if (cw >= 4) {
        for (let i = 0; i < n; i++) {
          if (fate[i] !== -1) continue;
          const x = inBox.x + i * cw;
          const y = inBox.y + inBox.h - Math.min(cw, 10);
          p.line(x + 1, y, x + cw - 1, y + Math.min(cw, 10) - 1);
          p.line(x + 1, y + Math.min(cw, 10) - 1, x + cw - 1, y);
        }
      }
      p.noStroke();
      const kept = run.state.kept;
      drawBars(p, outBox, {
        keys: run.a.key, max: n, fg: ctx.fg, slots: n,
        color: (i) => (i < kept ? color(run.a.key[i]) : mix(color(run.a.key[i]), ctx.bg, 0.85)),
      });
      const size = Math.max(10, Math.min(13, ctx.width / 52));
      caption(p, ctx.fg, `input: ${fmt(kept)} kept, ${fmt(Math.max(0, run.state.at - kept))} eliminated`, pad, pad, size);
      caption(p, ctx.fg, `array: survivors compacted to the front${run.stepper.done ? `, ${fmt(kept)} of ${fmt(n)} remain` : ''}`,
        pad, top + h + 2, size);
    }

    function publish() {
      const t = run.stepper.t;
      const mean = new Series('mean of finished runs (counted)');
      if (runs) for (let i = 0; i < n; i++) mean.push(i + 1, sumAt[i] / runs);
      ctx.stats([
        { label: 'kept / eliminated so far', value: `${fmt(run.state.kept)} / ${fmt(Math.max(0, run.state.at - run.state.kept))}` },
        { label: 'comparisons, reads, writes', value: `${fmt(t.counts.cmp)}, ${fmt(t.counts.read)}, ${fmt(t.counts.write)}` },
        { label: 'finished runs', value: fmt(runs) },
        { label: 'mean survivors per run', value: runs ? fmt(keptSum / runs, 2) : '–' },
        { label: 'H_n, expected for a Random permutation', value: shape === 'random' ? fmt(harmonic(n), 2) : 'not this input shape' },
        { label: 'last result', value: runs
          ? `${fmt(lastKept)} survivors, ${lastSubsequence ? 'a sorted subsequence of the input (checked)' : 'NOT a sorted subsequence'}`
          : '–' },
      ]);
      ctx.chart(chartOf('Survivors along the sweep', { label: 'keys judged' }, { label: 'survivors' },
        [live, mean, theory]));
    }
  },
};

export default stalinSort;
