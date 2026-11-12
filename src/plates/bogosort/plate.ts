import { caption } from '../_shared/bars/bars';
import { fmt } from '../_shared/live-chart/series';
import { SHAPES } from '../_shared/sort-input/input';
import { trialPlate } from '../_shared/trial-plate/trial-plate';
import { bogoRun, expectedShuffles } from './bogosort';

export default trialPlate({
  id: 'bogosort',
  n: { min: 2, max: 9, value: 5 },
  shapes: SHAPES,
  attempts: 'shuffles',
  theory: 'expected n!/Πmᵢ! per unsorted input',
  start(keys, seed) {
    const r = bogoRun(keys, seed);
    return { ...r, expected: expectedShuffles(keys), attempts: () => r.state.shuffles };
  },
  stats(run) {
    const t = run.stepper.t;
    return [{ label: 'kernel phase', value: t.phaseText || 'first check' }];
  },
  drawBand(p, ctx, box, run) {
    // this run's shuffles on a log scale against the expected count: a geometric variable spreads
    // over orders of magnitude around its mean
    const e = Math.max(1, run.expected);
    const top = Math.max(10, e * 8);
    const x = (v: number) => box.x + (Math.log10(1 + v) / Math.log10(1 + top)) * box.w;
    const y = box.y + box.h * 0.45;
    p.noStroke();
    p.fill(ctx.fg[0], ctx.fg[1], ctx.fg[2], 40);
    p.rect(box.x, y - 4, box.w, 8, 4);
    const pal = ctx.palette();
    const c = pal.stops[Math.floor(pal.stops.length / 2)];
    p.fill(c[0], c[1], c[2], 230);
    p.rect(box.x, y - 4, Math.max(2, Math.min(box.w, x(run.state.shuffles) - box.x)), 8, 4);
    p.fill(...ctx.fg);
    p.rect(x(e) - 1, y - 12, 2, 24);
    const size = Math.max(10, Math.min(12, ctx.width / 60));
    caption(p, ctx.fg, `shuffles this run (log scale): ${fmt(run.state.shuffles)}`, box.x, y + 14, size);
    caption(p, ctx.fg, `expected ${fmt(run.expected, 1)}`, Math.min(box.x + box.w, x(e) + 4), y - 28, size,
      x(e) > box.x + box.w * 0.7 ? 'right' : 'left');
  },
});
