import type { ParamDef, Params } from '../../core/plate';
import type { Bars, StochasticOps } from '../../engines/stochastic/trace';

/** Nominal coverage levels both interval methods are measured at. */
export const LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
export const SHOWN_LEVEL = 0.9;
export const COVERAGE = 'achieved coverage';

/** Which measured level the plate shows (its interval, ladder and readouts): every level is
 * measured whatever is shown, so this changes what is read, never what is drawn. One factory,
 * so that the uncertainty lab, which offers the union of its kernels' controls, has one. */
export const levelParam = (): ParamDef => ({
  kind: 'select', key: 'level', label: 'Nominal level shown', value: String(SHOWN_LEVEL), rebuild: true,
  options: LEVELS.map((l) => ({ value: String(l), label: `${Math.round(100 * l)}%` })),
});

/** The level a run shows: one of LEVELS, the default when the value is not one. */
export function shownLevel(cfg: Params): number {
  const l = Number(cfg.level);
  return LEVELS.includes(l) ? l : SHOWN_LEVEL;
}

/** A level as its readouts name it: 0.9 is "90%". */
export const levelName = (l: number) => `${Math.round(100 * l)}%`;

export const repetitionsParam = (value = 150): ParamDef => ({
  kind: 'range', key: 'reps', label: 'Repeated experiments', min: 20, max: 400, step: 10, value, rebuild: true,
});

export const coverageChart = {
  title: 'Coverage achieved against nominal',
  x: { label: 'nominal coverage' },
  y: { label: 'achieved coverage' },
};

/** Publish the coverage-against-nominal series from hit counts per level. */
export function publishCoverage(ops: StochasticOps, hits: number[], trials: number): void {
  ops.setSeries('nominal', LEVELS.map((l) => [l, l]));
  ops.setSeries(COVERAGE, LEVELS.map((l, i) => [l, trials ? hits[i] / trials : NaN]));
}

/** The latest intervals against the truth: covering ones in one tone, misses in another. */
export function ladder(title: string, rows: { label: string; lo: number; hi: number; truth: number }[], x: [number, number]): Bars {
  return {
    kind: 'bars', title, x,
    rows: rows.map((r) => ({
      label: r.label, lo: r.lo, hi: r.hi, mark: r.truth,
      tone: r.lo <= r.truth && r.truth <= r.hi ? 0.6 : 0.05,
    })),
  };
}
