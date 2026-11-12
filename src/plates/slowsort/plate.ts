import { powerFit } from '../_shared/live-chart/series';
import { scalingPlate } from '../_shared/scaling-plate/scaling-plate';
import { slowComparisons, slowRun } from './slowsort';

/** Sizes up to this share of n are fitted with a power of n, and the line extended to n. */
const SMALL = 0.5;

export default scalingPlate({
  id: 'slowsort',
  kernel: 'slowsort',
  n: { min: 2, max: 96, value: 16 },
  start: (keys, seed) => slowRun(keys, seed),
  recurrence: slowComparisons,
  reference(n, measured) {
    // a power law fitted to the small sizes the kernel measured, extended: the measured curve
    // bends away above it, which is what "faster than any fixed power" looks like
    const h = Math.max(4, Math.floor(n * SMALL));
    const fit = powerFit(measured.filter(([m]) => m >= 3 && m <= h));
    if (!Number.isFinite(fit.k)) return { name: 'power fitted to the small sizes (measuring)', points: [] };
    const points: [number, number][] = [];
    for (let m = 2; m <= n; m++) points.push([m, fit.c * m ** fit.k]);
    return { name: `n^${fit.k.toFixed(2)} fitted to n ≤ ${h}`, points };
  },
  growth(n) {
    const half = Math.max(2, Math.ceil(n / 2));
    const local = n > half ? Math.log(slowComparisons(n) / slowComparisons(half)) / Math.log(n / half) : NaN;
    return [
      { label: `local exponent from n = ${half} to ${n} (recurrence)`, value: Number.isFinite(local) ? local.toFixed(3) : '–' },
    ];
  },
});
