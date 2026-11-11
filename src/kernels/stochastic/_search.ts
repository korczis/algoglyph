import type { ParamDef } from '../../core/plate';
import { fmt } from '../../engines/stochastic/sample';
import type { Landscape } from '../../engines/stochastic/scenarios';
import type { StochasticOps } from '../../engines/stochastic/trace';

export interface SearchResult {
  landscape: string;
  /** Best objective value the algorithm found, and where. */
  best: number;
  bestAt: [number, number];
  /** Best value of uniform random search given the same number of evaluations. */
  randomBest: number;
  /** Evaluations the algorithm used (random search used as many). */
  evals: number;
}

export const budgetParam = (): ParamDef => ({
  kind: 'range', key: 'budget', label: 'Evaluation budget', min: 600, max: 6000, step: 200, value: 2400, rebuild: true,
});

/** Uniform random search, one evaluation at a time, as the baseline every search must beat. */
export class RandomSearch {
  best = Infinity;
  at: [number, number] = [0, 0];
  constructor(private readonly ops: StochasticOps, private readonly l: Landscape) {}
  step(): void {
    const x = this.l.x[0] + this.ops.rnd() * (this.l.x[1] - this.l.x[0]);
    const y = this.l.y[0] + this.ops.rnd() * (this.l.y[1] - this.l.y[0]);
    const v = this.ops.evaluate(this.l.f, x, y);
    if (v < this.best) { this.best = v; this.at = [x, y]; }
  }
}

export const clamp = (v: number, r: [number, number]) => Math.max(r[0], Math.min(r[1], v));

export function searchStats(name: string, evals: number, best: number, rs: RandomSearch, l: Landscape) {
  return [
    { label: `${name} best`, value: fmt(best, 4) },
    { label: 'Random search best', value: `${fmt(rs.best, 4)} (same ${fmt(evals)} evaluations)` },
    { label: 'Gap to the known minimum', value: fmt(best - l.min, 4) },
  ];
}
