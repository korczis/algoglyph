import { str } from '../../core/plate';
import { caption } from '../_shared/bars/bars';
import { fmt } from '../_shared/live-chart/series';
import { DISTINCT } from '../_shared/sort-input/input';
import { trialPlate } from '../_shared/trial-plate/trial-plate';
import { bozoRun, expectedSwaps, type Rule } from './bozosort';

const rule = (v: unknown): Rule => (v === 'inversion' ? 'inversion' : 'any');

export default trialPlate({
  id: 'bozosort',
  n: { min: 2, max: 8, value: 5 },
  shapes: DISTINCT,
  extra: [{
    kind: 'select', key: 'rule', label: 'Swap rule', value: 'any', rebuild: true,
    options: [
      { value: 'any', label: 'Any random pair (bozosort)' },
      { value: 'inversion', label: 'Only an inversion (the repair)' },
    ],
  }],
  attempts: 'swaps',
  theory: (params) => (rule(params.rule) === 'any'
    ? 'expected swaps (exact Markov chain)' : 'inversions of the input (an upper bound)'),
  start(keys, seed, ctx) {
    const r = rule(str(ctx.params, 'rule'));
    const run = bozoRun(keys, seed, r);
    // the repair never undoes progress: each swap removes at least one inversion
    const expected = r === 'any' ? expectedSwaps(keys) : run.state.inversions;
    return { ...run, expected, attempts: () => run.state.swaps };
  },
  stats(run) {
    const s = run.state;
    return [
      { label: 'inversions now', value: fmt(s.inversions) },
      { label: 'swaps that removed / added / kept inversions', value: `${fmt(s.better)} / ${fmt(s.worse)} / ${fmt(s.idle)}` },
      { label: 'random pairs drawn', value: fmt(s.picks) },
    ];
  },
  drawBand(p, ctx, box, run) {
    // the walk: inversions after the swaps of this run, from the input's count down to zero
    const w = run.state.walk;
    const n = run.keys.length;
    const top = Math.max(1, (n * (n - 1)) / 2);
    const pal = ctx.palette();
    const c = pal.stops[Math.floor(pal.stops.length / 3)];
    p.noFill();
    p.stroke(ctx.fg[0], ctx.fg[1], ctx.fg[2], 50);
    p.strokeWeight(1);
    p.line(box.x, box.y + box.h, box.x + box.w, box.y + box.h);
    p.stroke(c[0], c[1], c[2], 230);
    p.strokeWeight(1.5);
    p.beginShape();
    const step = Math.max(1, Math.floor(w.length / Math.max(1, box.w)));
    for (let i = 0; i < w.length; i += step) {
      p.vertex(box.x + (i / Math.max(1, w.length - 1)) * box.w, box.y + box.h - (w[i] / top) * box.h);
    }
    p.endShape();
    p.noStroke();
    const size = Math.max(10, Math.min(12, ctx.width / 60));
    caption(p, ctx.fg, `inversions along the walk (0 = sorted, top = ${fmt(top)})`, box.x, box.y - 4, size);
  },
});
