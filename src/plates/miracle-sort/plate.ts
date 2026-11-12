// Miracle sort: the check sweeps the array, stops at the first descent and waits; then it checks
// again and finds the same descent, because nothing ever writes to the array. Every readout is
// counted: the comparisons of each check, the writes (none), the inversions recounted after each
// wait and a comparison of the array with the input it was given.
import { paletteParam, ramp, mix } from '../../core/palette';
import { num, type PlateCode } from '../../core/plate';
import { caption, drawBars, padding, slotWidth, type Box } from '../_shared/bars/bars';
import { STEP_PACE, stepPaceParam, stepPacer } from '../_shared/kernel-mirror/controls';
import { items, Stepper, Tracer } from '../_shared/kernel-mirror/tracer';
import { chartOf, fmt, Series } from '../_shared/live-chart/series';
import { input, inversions, runSeed, SHAPES, shapeOf, shapeParam } from '../_shared/sort-input/input';
import { miracleCheck, type CheckState } from './miracle';

const miracleSort: PlateCode = {
  id: 'miracle-sort',
  mode: '2d',
  aspect: 16 / 10,
  thumbnailFrames: 30,
  params: [
    { kind: 'range', key: 'n', label: 'Keys n', min: 2, max: 256, step: 1, value: 24, rebuild: true },
    shapeParam(SHAPES, 'random'),
    { kind: 'range', key: 'wait', label: 'Wait between checks (frames)', min: 0, max: 240, step: 1, value: 60 },
    stepPaceParam(),
    paletteParam('spectral'),
  ],
  pace: STEP_PACE,
  create(p, ctx) {
    const params = ctx.params;
    const pacer = stepPacer();
    const n = num(params, 'n');
    const original = input(shapeOf(params.shape), n, runSeed(ctx.seed, 0));
    const a = items(original);
    const t = new Tracer(runSeed(ctx.seed, 0));
    const st: CheckState = { descent: -1 };
    let check = new Stepper(miracleCheck(t, a, st), t);
    let checks = 0;
    let waited = 0;
    let lastCmp = 0;
    let perCheck = 0;
    let unchanged = true;
    let inv = inversions(a.key);
    const cmpSeries = new Series('comparisons per check (counted)');
    const invSeries = new Series('inversions in the array (recounted)');
    const wrSeries = new Series('writes to the array, all checks (counted)');

    const endCheck = () => {
      checks++;
      perCheck = t.counts.cmp - lastCmp;
      lastCmp = t.counts.cmp;
      unchanged = a.key.every((k, i) => k === original[i]);
      inv = inversions(a.key);
      cmpSeries.push(checks, perCheck);
      invSeries.push(checks, inv);
      wrSeries.push(checks, t.counts.write + t.counts.swap);
      waited = 0;
    };

    return {
      pace: () => pacer.report(false, params),
      setup() {
        p.textFont('monospace');
      },
      draw() {
        if (!check.done) {
          check.advance(ctx.thumbnail ? 4 : pacer.take(params));
          if (check.done) endCheck();
        } else if (check.outcome === 'not-a-sort') {
          waited++;
          if (waited > num(params, 'wait')) check = new Stepper(miracleCheck(t, a, st), t);
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
      const band = Math.round(ctx.height * 0.16);
      const box: Box = { x: pad, y: top, w: ctx.width - 2 * pad, h: ctx.height - top - band - pad };
      const cw = slotWidth(box, n);
      const scanning = !check.done && t.last.op === 'cmp';
      const reach = scanning ? t.last.j : st.descent;
      drawBars(p, box, {
        keys: a.key, max: n, fg: ctx.fg,
        touched: scanning ? [t.last.i, t.last.j] : st.descent > 0 ? [st.descent - 1, st.descent] : [],
        color: (i) => {
          const c = ramp(pal, n > 1 ? (a.key[i] - 1) / (n - 1) : 0.5);
          return reach >= 0 && i > reach ? mix(c, ctx.bg, 0.6) : c;
        },
      });
      if (check.done && st.descent > 0) {
        // the descent the check stopped at, the same one every time
        p.noFill();
        p.stroke(...ctx.fg);
        p.strokeWeight(2);
        p.rect(box.x + (st.descent - 1) * cw, box.y, 2 * cw, box.h, 3);
        p.noStroke();
      }
      const size = Math.max(10, Math.min(13, ctx.width / 52));
      const status = !check.done ? `check ${checks + 1}: sweeping`
        : check.outcome === 'sorted' ? `sorted on check ${checks}: it was sorted already`
          : `check ${checks}: descent at ${st.descent} · waiting for a miracle`;
      caption(p, ctx.fg, status, pad, pad, size);
      // the wait, as a bar that fills and empties: time passes, nothing else does
      const wait = Math.max(1, num(params, 'wait'));
      const y = ctx.height - pad - band / 2;
      p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 36);
      p.rect(pad, y - 4, box.w, 8, 4);
      if (check.done && check.outcome === 'not-a-sort') {
        const c = pal.stops[pal.stops.length - 2];
        p.fill(c[0], c[1], c[2], 220);
        p.rect(pad, y - 4, Math.min(box.w, (waited / wait) * box.w), 8, 4);
      }
      caption(p, ctx.fg, `waiting · ${fmt(t.counts.write + t.counts.swap)} writes so far`, pad, y + 8, Math.max(9, size - 2));
    }

    function publish() {
      ctx.stats([
        { label: 'checks', value: fmt(checks) },
        { label: 'comparisons, all checks', value: fmt(t.counts.cmp) },
        { label: 'comparisons in the last check', value: checks ? fmt(perCheck) : '–' },
        { label: 'writes and swaps to the array', value: fmt(t.counts.write + t.counts.swap) },
        { label: 'array against its input', value: unchanged ? 'unchanged (compared key by key)' : 'CHANGED' },
        { label: 'inversions', value: fmt(inv) },
        { label: 'outcome', value: check.done ? (check.outcome === 'sorted' ? 'sorted (the input was)' : 'not a sort: waits for a miracle') : 'checking' },
        pacer.row(params),
      ]);
      ctx.chart(chartOf('Each check finds the same array', { label: 'checks' }, { label: 'count' },
        [cmpSeries, invSeries, wrSeries]));
    }
  },
};

export default miracleSort;
