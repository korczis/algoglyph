import { fmt, powerFit } from '../_shared/live-chart/series';
import { scalingPlate } from '../_shared/scaling-plate/scaling-plate';
import { STOOGE_EXPONENT, stoogeComparisons, stoogeRun } from './stooge';

export default scalingPlate({
  id: 'stooge-sort',
  kernel: 'stooge-sort',
  n: { min: 2, max: 128, value: 24 },
  start: (keys, seed) => stoogeRun(keys, seed),
  recurrence: stoogeComparisons,
  reference(n) {
    // c·n^(log 3 / log 1.5), drawn through the exact count at the chosen n
    const c = stoogeComparisons(n) / n ** STOOGE_EXPONENT;
    const points: [number, number][] = [];
    for (let m = 2; m <= n; m++) points.push([m, c * m ** STOOGE_EXPONENT]);
    return { name: `∝ n^${STOOGE_EXPONENT.toFixed(4)} (master theorem)`, points };
  },
  growth(_n, measured) {
    const fit = powerFit(measured.filter(([m]) => m >= 4));
    return [
      { label: 'growth exponent fitted to the kernel', value: Number.isFinite(fit.k) ? `n^${fit.k.toFixed(3)}` : 'measuring' },
      { label: 'master theorem: log 3 / log 1.5', value: STOOGE_EXPONENT.toFixed(4) },
      { label: 'kernel sizes measured', value: fmt(measured.length) },
    ];
  },
});
