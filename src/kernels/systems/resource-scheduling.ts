import { num } from '../../core/plate';
import type { SystemsKernel } from '../../engines/systems/sim';

// List scheduling of a seeded task graph (builds that depend on builds) on a pool of identical
// resource units. Each task has a duration and needs some units for all of it. Its priority is
// its bottom level: the longest chain of durations from its start to the end of the graph, so
// the critical path goes first. At time zero and at every completion the scheduler walks the
// ready tasks in priority order and starts each one that fits in the units still free (the
// parallel schedule-generation scheme), so no ready task waits while enough units are idle.

export interface Task { id: number; preds: number[]; dur: number; demand: number; prio: number;
  start: number; finish: number; units: number[]; ready: number }
export interface Decision { t: number; free: number; waiting: number[] }
export interface ScheduleResult { tasks: Task[]; capacity: number; decisions: Decision[]; critical: number; work: number }

/** A seeded layered task graph. */
export function graph(n: number, capacity: number, rnd: () => number): Task[] {
  const tasks: Task[] = [];
  for (let i = 0; i < n; i++) {
    const preds: number[] = [];
    for (let j = Math.max(0, i - 6); j < i; j++) if (rnd() < 0.28) preds.push(j);
    tasks.push({
      id: i, preds, dur: 100 + Math.floor(rnd() * 9) * 50,
      demand: 1 + Math.floor(rnd() * Math.min(3, capacity)), prio: 0,
      start: NaN, finish: NaN, units: [], ready: NaN,
    });
  }
  for (let i = n - 1; i >= 0; i--) {
    let tail = 0;
    for (const s of tasks) if (s.preds.includes(i)) tail = Math.max(tail, s.prio);
    tasks[i].prio = tasks[i].dur + tail;
  }
  return tasks;
}

export const kernel: SystemsKernel<ScheduleResult> = {
  params: [
    { kind: 'range', key: 'tasks', label: 'Tasks', min: 4, max: 30, step: 1, value: 18, rebuild: true },
    { kind: 'range', key: 'units', label: 'Resource units', min: 2, max: 8, step: 1, value: 4, rebuild: true },
  ],
  setup: (p) => ({
    lanes: Array.from({ length: num(p, 'units') }, (_, i) => `unit ${i + 1}`),
    // generous: a run never needs more than the sum of its durations
    horizon: num(p, 'tasks') * 500 + 200,
    fit: true,
    window: Number.MAX_SAFE_INTEGER,
  }),
  install(net, p) {
    const C = num(p, 'units');
    const tasks = graph(num(p, 'tasks'), C, net.rnd);
    const critical = Math.max(0, ...tasks.map((t) => t.prio));
    const work = tasks.reduce((s, t) => s + t.dur * t.demand, 0);
    const res: ScheduleResult = { tasks, capacity: C, decisions: [], critical, work };
    const busy = new Array<number>(C).fill(-1);
    const left = tasks.map((t) => t.preds.length);
    const ready: Task[] = tasks.filter((t) => !t.preds.length);
    for (const t of ready) t.ready = 0;
    let done = 0; let busyUnits = 0;
    const decide = () => {
      ready.sort((a, b) => b.prio - a.prio || a.id - b.id);
      let free = busy.filter((x) => x < 0).length;
      for (let k = 0; k < ready.length;) {
        const t = ready[k];
        if (t.demand > free) { k++; continue; }
        ready.splice(k, 1);
        t.start = net.now;
        for (let u = 0; u < C && t.units.length < t.demand; u++) if (busy[u] < 0) { busy[u] = t.id; t.units.push(u); }
        free -= t.demand;
        busyUnits += t.demand;
        for (const u of t.units) net.state(u, `T${t.id + 1}`);
        net.mark(t.units[0], `T${t.id + 1}`, 0.2 + 0.75 * (t.prio / Math.max(1, critical)));
        for (const q of t.preds) net.link(tasks[q].units[0], t.units[0], tasks[q].finish, net.now, '');
        net.count('started');
        net.after(t.dur, () => finish(t));
      }
      res.decisions.push({ t: net.now, free, waiting: ready.map((x) => x.id) });
      net.sample('ready but waiting', ready.length);
      net.sample('units busy', busyUnits);
    };
    const finish = (t: Task) => {
      t.finish = net.now;
      for (const u of t.units) { busy[u] = -1; net.state(u, ''); }
      busyUnits -= t.demand;
      done++;
      net.count('finished');
      for (const s of tasks) {
        if (!s.preds.includes(t.id)) continue;
        if (--left[s.id] === 0) { s.ready = net.now; ready.push(s); }
      }
      if (done === tasks.length) {
        net.gauge('makespan', net.now);
        net.gauge('utilisation', (100 * work) / (C * net.now));
        net.sample('ready but waiting', 0);
        net.sample('units busy', 0);
        net.stop();
        return;
      }
      // decide once per instant, after every completion at this time has been seen
      if (!pending) { pending = true; net.after(0, () => { pending = false; decide(); }); }
    };
    let pending = false;
    for (let u = 0; u < C; u++) net.state(u, '');
    net.gauge('critical', critical);
    net.after(0, decide);
    return res;
  },
  readouts: [
    { key: 'started', label: 'Tasks started' },
    { key: 'finished', label: 'Tasks finished' },
    { key: 'critical', kind: 'gauge', label: 'Critical path (lower bound)', unit: ' ms' },
    { key: 'makespan', kind: 'gauge', label: 'Makespan', unit: ' ms' },
    { key: 'utilisation', kind: 'gauge', label: 'Utilisation', unit: ' %', digits: 1 },
  ],
  chart: { title: 'Units busy and tasks waiting', y: 'count', series: ['units busy', 'ready but waiting'] },
  verdict(r) {
    const end = Math.max(...r.tasks.map((t) => t.finish));
    const lb = Math.max(r.critical, r.work / r.capacity);
    return Number.isFinite(end) ? `makespan ${end} ms, ${(end / lb).toFixed(2)} × the lower bound ${Math.round(lb)} ms` : 'unfinished';
  },
};
