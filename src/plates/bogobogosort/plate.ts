import { mix } from '../../core/palette';
import { caption } from '../_shared/bars/bars';
import { fmt } from '../_shared/live-chart/series';
import { DISTINCT } from '../_shared/sort-input/input';
import { trialPlate } from '../_shared/trial-plate/trial-plate';
import { bbsRun, expectedShuffles } from './bogobogosort';

export default trialPlate({
  id: 'bogobogosort',
  n: { min: 2, max: 8, value: 5 },
  shapes: DISTINCT,
  attempts: 'shuffles',
  theory: 'expected Σ m! over failing prefixes',
  start(keys, seed) {
    const r = bbsRun(keys, seed);
    return { ...r, expected: expectedShuffles(keys), attempts: () => r.state.shuffles };
  },
  color(run, i, pal, ctx) {
    // keys past the prefix being worked on wait, dimmed
    const n = run.keys.length;
    const c = pal(n > 1 ? (run.keys[i] - 1) / (n - 1) : 0.5);
    return run.stepper.done || i < run.state.prefix ? c : mix(c, ctx.bg, 0.65);
  },
  stats(run) {
    const s = run.state;
    return [
      { label: 'prefix being checked', value: run.stepper.done ? 'done' : `${s.prefix} of ${run.keys.length}` },
      { label: 'shuffles by prefix length', value: s.level.slice(2).map((x, m) => `${m + 2}: ${fmt(x)}`).join(' · ') || '–' },
    ];
  },
  drawBand(p, ctx, box, run) {
    // shuffles spent at each prefix length in this run: the short prefixes are reshuffled far
    // more often, because every failure of a longer prefix sorts them again from scratch
    const lv = run.state.level;
    const n = run.keys.length;
    const top = Math.max(1, ...lv);
    const cw = box.w / Math.max(1, n - 1);
    const size = Math.max(10, Math.min(12, ctx.width / 60));
    const pal = ctx.palette();
    p.noStroke();
    for (let m = 2; m <= n; m++) {
      const h = (Math.log10(1 + lv[m]) / Math.log10(1 + top)) * (box.h - 2 * size - 6) || 0;
      const x = box.x + (m - 2) * cw;
      const c = pal.stops[(m - 2) % pal.stops.length];
      p.fill(c[0], c[1], c[2], m === run.state.prefix && !run.stepper.done ? 255 : 170);
      p.rect(x + cw * 0.15, box.y + box.h - size - 4 - h, cw * 0.7, Math.max(1, h), 2);
      caption(p, ctx.fg, `m=${m}`, x + cw / 2, box.y + box.h - size, size, 'center');
      caption(p, ctx.fg, fmt(lv[m]), x + cw / 2, box.y + box.h - size - 6 - h - size, size, 'center');
    }
  },
});
