import { num } from '../../core/plate';
import { fmt, pm, Sampler, SortedSample } from '../../engines/stochastic/sample';
import { taskNetwork, type Task } from '../../engines/stochastic/scenarios';
import { histogram, type StochasticKernel } from '../../engines/stochastic/trace';

/** The PERT-Beta shape of a task: alpha = 1 + 4 (m - a) / (b - a), beta = 1 + 4 (b - m) / (b - a). */
export function pertShape(t: Pick<Task, 'a' | 'm' | 'b'>): [number, number] {
  return [1 + (4 * (t.m - t.a)) / (t.b - t.a), 1 + (4 * (t.b - t.m)) / (t.b - t.a)];
}

/** Earliest finish of every task and of the project (tasks in topological order), and the
 * critical path traced back from the last-finishing task. */
export function longestPath(tasks: Task[], d: number[]): { finish: number; path: number[] } {
  const end = new Array<number>(tasks.length).fill(0);
  const from = new Array<number>(tasks.length).fill(-1);
  tasks.forEach((t, i) => {
    let start = 0;
    for (const p of t.after) if (end[p] > start) { start = end[p]; from[i] = p; }
    end[i] = start + d[i];
  });
  let last = 0;
  end.forEach((e, i) => { if (e > end[last]) last = i; });
  const path: number[] = [];
  for (let i = last; i >= 0; i = from[i]) path.unshift(i);
  return { finish: end[last], path };
}

export interface PertResult {
  tasks: Task[];
  finishes: number[];
  /** Share of runs in which each task lay on the critical path. */
  criticality: number[];
  /** The project length with every task at its PERT mean (a + 4m + b) / 6. */
  deterministic: number;
}

const FRAMES = 140;

// Every run draws each task's duration from its PERT-Beta distribution (two Gamma draws per
// task), pushes the durations through the network's precedence and records the project's
// finish and which tasks were critical. The finishes' quantiles are the schedule's P50 to P90.
export const kernel: StochasticKernel<PertResult> = {
  palette: 'ember',
  params: [{ kind: 'range', key: 'n', label: 'Simulated projects', min: 500, max: 40000, step: 500, value: 6000, rebuild: true }],
  chart: { title: 'Schedule quantiles as runs accumulate', x: { label: 'runs', log: true }, y: { label: 'project length' } },
  *run(ops, cfg) {
    const s = new Sampler(() => ops.rnd());
    const tasks = taskNetwork(s);
    const n = num(cfg, 'n');
    const shapes = tasks.map(pertShape);
    const means = tasks.map((t) => (t.a + 4 * t.m + t.b) / 6);
    const det = longestPath(tasks, means);
    const finishes: number[] = [];
    // kept sorted as it grows, so the quantiles never need a full re-sort
    const sorted = new SortedSample();
    const bins = new Array<number>(44).fill(0);
    const critical = new Array<number>(tasks.length).fill(0);
    const lo = det.finish * 0.6;
    const hi = tasks.reduce((t, x) => t + x.b, 0) * 0.75;
    // the network drawn by layer, edges from each task to the tasks after it
    const layers = Math.max(...tasks.map((t) => t.layer)) + 1;
    const pos = tasks.map((t) => {
      const same = tasks.filter((u) => u.layer === t.layer);
      return [(t.layer + 0.5) / layers, (same.indexOf(t) + 0.5) / same.length] as [number, number];
    });
    const edges = tasks.flatMap((t, i) => t.after.map((p) => ({ pts: [pos[p], pos[i]] as [number, number][], tone: -1, weight: 1, alpha: 0.35 })));
    let done = 0;
    let sum = 0;
    let sum2 = 0;
    for (let fr = 1; fr <= FRAMES; fr++) {
      const end = Math.max(1, Math.round(n * (fr / FRAMES) ** 2));
      for (; done < end; done++) {
        const d = tasks.map((t, i) => t.a + (t.b - t.a) * s.beta(shapes[i][0], shapes[i][1]));
        const r = ops.evaluate(longestPath, tasks, d);
        finishes.push(r.finish);
        sum += r.finish;
        sum2 += r.finish * r.finish;
        for (const i of r.path) critical[i]++;
        if (done % 1000 === 999) yield;
      }
      histogram(finishes, lo, hi, 44, sorted.length, done, bins);
      sorted.add(finishes.slice(sorted.length, done));
      const p50 = sorted.quantile(0.5);
      const p80 = sorted.quantile(0.8);
      const p90 = sorted.quantile(0.9);
      const mean = sum / done;
      const sd = Math.sqrt(Math.max(0, (sum2 - done * mean * mean) / Math.max(1, done - 1)));
      ops.point('P50', done, p50);
      ops.point('P90', done, p90);
      ops.point('all tasks at their mean', done, det.finish);
      const crit = critical.map((c) => c / done);
      const top = crit.reduce((b, c, i) => (c > crit[b] ? i : b), 0);
      ops.frame([
        {
          kind: 'hist', title: 'Simulated project lengths; P50 to P90 shaded', lo, hi, bins: bins.slice(), shade: [p50, p90],
          marks: [{ x: det.finish, label: 'tasks at mean', tone: -1, dash: true }, { x: p80, label: 'P80', tone: -1 }],
        },
        {
          kind: 'plot', title: 'Network; brighter tasks are critical more often', x: [0, 1], y: [0, 1],
          lines: edges,
          dots: [{ pts: pos, tones: crit.map((c) => 0.1 + 0.85 * c), size: 9 }],
        },
      ], [
        { label: 'Runs', value: fmt(done) },
        { label: 'Mean length', value: pm(mean, sd / Math.sqrt(done), 2) },
        { label: 'P50 / P80 / P90', value: `${fmt(p50, 1)} / ${fmt(p80, 1)} / ${fmt(p90, 1)}` },
        { label: 'With every task at its mean', value: `${fmt(det.finish, 1)} (the merge bias is the gap to the mean)` },
        { label: `Most critical: ${tasks[top].name}`, value: `on the critical path in ${fmt(100 * crit[top], 1)}% of runs` },
      ]);
      yield;
    }
    return { tasks, finishes, criticality: critical.map((c) => c / n), deterministic: det.finish };
  },
};
