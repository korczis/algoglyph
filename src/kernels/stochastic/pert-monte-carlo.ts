import type { DataTable } from '../../core/data';
import { num, type Stat } from '../../core/plate';
import { mulberry32 } from '../../core/random';
import { finite, integer, record, unknownKeys, type DataForm } from '../../core/solve';
import { readerInput, readerTable } from '../../engines/stochastic/reader';
import { fmt, pm, Sampler, SortedSample } from '../../engines/stochastic/sample';
import { taskNetwork, type Task } from '../../engines/stochastic/scenarios';
import { histogram, type StochasticKernel } from '../../engines/stochastic/trace';

/** The PERT-Beta shape of a task with weight λ (4 classically): alpha = 1 + λ (m - a) / (b - a),
 * beta = 1 + λ (b - m) / (b - a), so its mean is (a + λm + b) / (λ + 2). */
export function pertShape(t: Pick<Task, 'a' | 'm' | 'b'>, lambda = 4): [number, number] {
  return [1 + (lambda * (t.m - t.a)) / (t.b - t.a), 1 + (lambda * (t.b - t.m)) / (t.b - t.a)];
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
  /** The project length with every task at its PERT mean (a + λm + b) / (λ + 2). */
  deterministic: number;
}

const FRAMES = 140;
/** Task durations drawn between yields: 1000 runs of the seeded network's 10 tasks. */
const PIECE = 10_000;
/** The most task durations a run on a reader's tasks draws: the seeded plate's largest, 40,000
 * runs of its 10 tasks; a longer list gets fewer runs. */
export const READER_WORK = 400_000;

/**
 * A reader's tasks as a chain, each after the one before: a table carries no precedence. Each
 * row's three values are sorted, so (min, mode, max) in any order reads as a <= m <= b; a row
 * with a = b is a task of fixed length.
 */
export function chainOf(t: DataTable): Task[] {
  return Array.from({ length: t.rows }, (_, i) => {
    const [a, m, b] = [t.values[0][i], t.values[1][i], t.values[2][i]].sort((x, y) => x - y);
    return { name: `row ${i + 1}`, a, m, b, after: i ? [i - 1] : [], layer: i };
  });
}

/** The PERT-Beta variance of a task: (b - a)² αβ / ((α + β)² (α + β + 1)). */
function pertVariance(t: Task, lambda: number): number {
  if (!(t.b > t.a)) return 0;
  const [al, be] = pertShape(t, lambda);
  return ((t.b - t.a) ** 2 * al * be) / ((al + be) ** 2 * (al + be + 1));
}

/** The largest network and simulation the data form takes. */
export const LIMITS = { tasks: 500, runs: 200_000, work: 5_000_000 };

/** The q-quantile of an ascending sample, by the nearest rank. */
const rank = (xs: number[], q: number) => xs[Math.min(xs.length - 1, Math.max(0, Math.ceil(q * xs.length) - 1))];

/**
 * A caller's project {tasks: [{name?, a, m, b, after}], runs?, lambda?, seed?}: tasks in
 * topological order (each `after` names earlier tasks only), durations a <= m <= b with a < b.
 * The same PERT-Beta draws and longest path as the plate, seeded, so a run is reproducible.
 */
export const data: DataForm = {
  input: '{tasks: [{name?, a, m, b, after: number[]}] in topological order, runs? (default 10000), lambda? (default 4), seed? (default 1)}',
  solve(raw) {
    if (!record(raw)) return 'the input must be an object {tasks, runs?, lambda?, seed?}';
    const extra = unknownKeys(raw, ['tasks', 'runs', 'lambda', 'seed']);
    if (extra) return extra;
    const { tasks: list, runs = 10_000, lambda = 4, seed = 1 } = raw;
    if (!Array.isArray(list) || !list.length || list.length > LIMITS.tasks) return `tasks must list 1 to ${LIMITS.tasks} tasks`;
    const tasks: Task[] = [];
    for (const [i, t] of list.entries()) {
      if (!record(t)) return `tasks[${i}] must be an object {name?, a, m, b, after}`;
      const { a, m, b, after = [], name = `task ${i + 1}` } = t;
      if (!finite(a) || !finite(m) || !finite(b) || a < 0 || !(a <= m && m <= b && a < b)) return `tasks[${i}]: durations must be finite with 0 <= a <= m <= b and a < b`;
      if (!Array.isArray(after) || !after.every((p) => Number.isInteger(p) && p >= 0 && p < i)) return `tasks[${i}].after must name earlier tasks only, by index 0..${i - 1}`;
      tasks.push({ name: String(name), a, m, b, after: after as number[], layer: 0 });
    }
    if (!integer(runs) || runs < 1 || runs > LIMITS.runs || runs * tasks.length > LIMITS.work) return `runs must be an integer 1..${LIMITS.runs} with runs × tasks at most ${LIMITS.work}`;
    if (!finite(lambda) || lambda < 0 || lambda > 100) return 'lambda must be a number 0..100';
    if (!integer(seed)) return 'seed must be an integer';
    const s = new Sampler(mulberry32(seed));
    const shapes = tasks.map((t) => pertShape(t, lambda));
    const det = longestPath(tasks, tasks.map((t) => (t.a + lambda * t.m + t.b) / (lambda + 2)));
    const finishes: number[] = [];
    const critical = new Array<number>(tasks.length).fill(0);
    for (let r = 0; r < runs; r++) {
      const d = tasks.map((t, i) => t.a + (t.b - t.a) * s.beta(shapes[i][0], shapes[i][1]));
      const run = longestPath(tasks, d);
      finishes.push(run.finish);
      for (const i of run.path) critical[i]++;
    }
    const mean = finishes.reduce((x, y) => x + y, 0) / runs;
    const sd = Math.sqrt(finishes.reduce((x, y) => x + (y - mean) ** 2, 0) / Math.max(1, runs - 1));
    finishes.sort((x, y) => x - y);
    return {
      runs, lambda, seed,
      deterministic: det.finish,
      criticalPath: det.path.map((i) => tasks[i].name),
      mean, sd, stderr: sd / Math.sqrt(runs),
      p50: rank(finishes, 0.5), p80: rank(finishes, 0.8), p90: rank(finishes, 0.9),
      min: finishes[0], max: finishes[runs - 1],
      criticality: tasks.map((t, i) => ({ task: t.name, share: critical[i] / runs })),
    };
  },
};

// Every run draws each task's duration from its PERT-Beta distribution (two Gamma draws per
// task), pushes the durations through the network's precedence and records the project's
// finish and which tasks were critical. The finishes' quantiles are the schedule's P50 to P90.
export const kernel: StochasticKernel<PertResult> = {
  data,
  palette: 'ember',
  params: [
    // the input: the seeded task network, and a reader's tasks (ADR 0010)
    {
      kind: 'select', key: 'project', label: 'Project', value: 'network', rebuild: true,
      options: [{ value: 'network', label: 'A seeded network of 10 tasks' }],
    },
    { kind: 'range', key: 'n', label: 'Simulated projects', min: 500, max: 40000, step: 500, value: 6000, rebuild: true },
    // λ = 0 is the uniform distribution on [a, b] (below it the shapes fall under 1, and far
    // enough under 0); past 10 every task is nearly fixed at m and the merge bias the plate shows
    // fades. The cost is the same at every λ: the same two Gamma draws a task
    { kind: 'range', key: 'lambda', label: 'PERT weight λ', min: 0, max: 10, step: 0.5, value: 4, rebuild: true },
  ],
  chart: { title: 'Schedule quantiles as runs accumulate', x: { label: 'runs', log: true }, y: { label: 'project length' } },
  *run(ops, cfg, reader) {
    const s = new Sampler(() => ops.rnd());
    // a reader's tasks (ADR 0010): one after another, with no seeded network around them
    const mine = readerTable(cfg, 'project', reader);
    const tasks = mine ? chainOf(mine) : taskNetwork(s);
    const n = mine ? Math.min(num(cfg, 'n'), Math.max(1, Math.floor(READER_WORK / tasks.length))) : num(cfg, 'n');
    const lambda = num(cfg, 'lambda');
    const shapes = tasks.map((t) => pertShape(t, lambda));
    const means = tasks.map((t) => (t.a + lambda * t.m + t.b) / (lambda + 2));
    const det = longestPath(tasks, means);
    const finishes: number[] = [];
    // kept sorted as it grows, so the quantiles never need a full re-sort
    const sorted = new SortedSample();
    const bins = new Array<number>(44).fill(0);
    const critical = new Array<number>(tasks.length).fill(0);
    let lo = det.finish * 0.6;
    let hi = tasks.reduce((t, x) => t + x.b, 0) * 0.75;
    if (mine) {
      // a chain's length has the tasks' summed variance: ±5 of its sd, inside [Σa, Σb]
      const sd = Math.sqrt(tasks.reduce((v, t) => v + pertVariance(t, lambda), 0));
      lo = sd > 0 ? Math.max(tasks.reduce((t, x) => t + x.a, 0), det.finish - 5 * sd) : det.finish - 1;
      hi = sd > 0 ? Math.min(tasks.reduce((t, x) => t + x.b, 0), det.finish + 5 * sd) : det.finish + 1;
    }
    const per = Math.max(1, Math.floor(PIECE / tasks.length));
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
        // a task of fixed length (a = b, a reader's only) takes no draw
        const d = tasks.map((t, i) => (t.b > t.a ? t.a + (t.b - t.a) * s.beta(shapes[i][0], shapes[i][1]) : t.a));
        const r = ops.evaluate(longestPath, tasks, d);
        finishes.push(r.finish);
        sum += r.finish;
        sum2 += r.finish * r.finish;
        for (const i of r.path) critical[i]++;
        if (done % per === per - 1) yield;
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
          kind: 'plot', title: mine ? 'Your tasks, one after another: every one is critical' : 'Network; brighter tasks are critical more often', x: [0, 1], y: [0, 1],
          lines: edges,
          dots: [{ pts: pos, tones: crit.map((c) => 0.1 + 0.85 * c), size: 9 }],
        },
      ], mine ? [
        readerInput(`${fmt(tasks.length)} tasks, one after another`),
        { label: 'Runs', value: n < num(cfg, 'n') ? `${fmt(done)} (at most ${fmt(n)} for ${fmt(tasks.length)} tasks)` : fmt(done) },
        { label: 'Mean length', value: pm(mean, sd / Math.sqrt(done), 2) },
        { label: 'P50 / P80 / P90', value: `${fmt(p50, 1)} / ${fmt(p80, 1)} / ${fmt(p90, 1)}` },
        { label: 'With every task at its mean', value: `${fmt(det.finish, 1)} (nothing merges in a chain, so no merge bias)` },
        { label: 'Critical path', value: 'every task, in every run: your tasks run one after another' },
      ] as Stat[] : [
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
