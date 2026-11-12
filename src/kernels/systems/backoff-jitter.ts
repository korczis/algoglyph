import { num } from '../../core/plate';
import type { SystemsKernel } from '../../engines/systems/sim';

// Two identical cohorts of clients, each in front of its own server, run side by side. Both
// servers go down for a while just as every client starts its job (a deploy, a restart), and
// each serves at most a fixed number of requests per window once it is back; the rest are
// refused. Every client retries with capped exponential backoff, base * 2^attempt. The lockstep
// cohort sleeps exactly that long, so its retries arrive together and keep overflowing the
// window; the jitter cohort sleeps a uniform random time in [0, base * 2^attempt) ("full
// jitter"), which spreads the same retries out.

export const BASE = 100;
export const CAP = 1600;
export const WINDOW = 100;

export interface Cohort { attempts: number[][]; done: number[]; delays: { attempt: number; sleep: number }[] }
export interface BackoffResult { lockstep: Cohort; jitter: Cohort; capacity: number; outage: [number, number] }

/** The most retries (first attempts left out) in one window of `WINDOW` ms from time `from`. */
export function peakRetries(c: Cohort, from = 0): number {
  const bins = new Map<number, number>();
  for (const a of c.attempts) for (let k = 1; k < a.length; k++) {
    if (a[k] < from) continue;
    const b = Math.floor(a[k] / WINDOW);
    bins.set(b, (bins.get(b) ?? 0) + 1);
  }
  return Math.max(0, ...bins.values());
}

export const kernel: SystemsKernel<BackoffResult> = {
  params: [
    { kind: 'range', key: 'clients', label: 'Clients per cohort', min: 5, max: 80, step: 1, value: 40, rebuild: true },
    { kind: 'range', key: 'capacity', label: 'Server capacity (requests per 100 ms)', min: 1, max: 30, step: 1, value: 6, rebuild: true },
  ],
  setup: () => ({
    lanes: ['clients · lockstep', 'server · lockstep', 'clients · jitter', 'server · jitter'],
    horizon: 12000,
    window: 12000,
    net: { delay: [2, 6] },
  }),
  install(net, p) {
    const N = num(p, 'clients'); const cap = num(p, 'capacity');
    const outage: [number, number] = [300, 1400];
    const mk = (): Cohort => ({ attempts: Array.from({ length: N }, () => []), done: [], delays: [] });
    const res: BackoffResult = { lockstep: mk(), jitter: mk(), capacity: cap, outage };
    const cohorts = [{ name: 'lockstep', c: res.lockstep, lane: 0, jitter: false }, { name: 'jitter', c: res.jitter, lane: 2, jitter: true }];
    for (const co of cohorts) {
      const served = new Map<number, number>();
      const server = co.lane + 1;
      const attempt = (i: number) => {
        const k = co.c.attempts[i].length;
        co.c.attempts[i].push(net.now);
        net.sample(co.name, 1);
        if (k > 0) net.count(`${co.name}.retries`);
        net.send(co.lane, server, 'req', () => {
          const w = Math.floor(net.now / WINDOW);
          const down = net.now >= outage[0] && net.now < outage[1];
          const used = served.get(w) ?? 0;
          const ok = !down && used < cap;
          if (ok) served.set(w, used + 1);
          net.send(server, co.lane, ok ? '200' : '503', () => {
            if (ok) {
              co.c.done.push(net.now);
              net.count(`${co.name}.done`);
              if (co.c.done.length === N) {
                net.gauge(`${co.name}.finished`, net.now);
                net.mark(co.lane, 'all done', 0.95);
              }
              return;
            }
            const ceiling = Math.min(CAP, BASE * 2 ** k);
            const sleep = co.jitter ? net.uniform(0, ceiling) : ceiling;
            co.c.delays.push({ attempt: k, sleep });
            net.after(sleep, () => attempt(i));
          }, { reliable: true });
        }, { reliable: true });
      };
      net.state(server, '');
      net.at(outage[0], () => { net.state(server, 'down'); net.mark(server, 'down', 0.05); });
      net.at(outage[1], () => { net.state(server, 'up'); net.mark(server, 'back', 0.6); });
      // every client starts within the same few milliseconds
      const start = net.uniform(390, 400);
      for (let i = 0; i < N; i++) net.at(start + net.uniform(0, 5), () => attempt(i));
    }
    const watch = () => {
      if (net.now >= outage[1]) {
        net.gauge('lockstep.peak', peakRetries(res.lockstep, outage[1]));
        net.gauge('jitter.peak', peakRetries(res.jitter, outage[1]));
      }
      net.after(WINDOW, watch);
    };
    net.after(0, watch);
    return res;
  },
  readouts: [
    { key: 'lockstep.peak', kind: 'gauge', label: 'Lockstep: peak retries per 100 ms after recovery' },
    { key: 'jitter.peak', kind: 'gauge', label: 'Jitter: peak retries per 100 ms after recovery' },
    { key: 'lockstep.retries', label: 'Lockstep: retries' },
    { key: 'jitter.retries', label: 'Jitter: retries' },
    { key: 'lockstep.done', label: 'Lockstep: jobs done' },
    { key: 'jitter.done', label: 'Jitter: jobs done' },
    { key: 'lockstep.finished', kind: 'gauge', label: 'Lockstep: all done at', unit: ' ms' },
    { key: 'jitter.finished', kind: 'gauge', label: 'Jitter: all done at', unit: ' ms' },
  ],
  chart: { title: 'Requests reaching each server per 100 ms', y: 'requests', series: ['lockstep', 'jitter'], bin: WINDOW },
  verdict(r) {
    const a = peakRetries(r.lockstep, r.outage[1]); const b = peakRetries(r.jitter, r.outage[1]);
    const end = (c: Cohort) => (c.done.length === c.attempts.length ? `${Math.round(Math.max(...c.done))} ms` : 'not all');
    return `after recovery, peak retries per window: lockstep ${a}, jitter ${b} (capacity ${r.capacity}); all done: lockstep ${end(r.lockstep)}, jitter ${end(r.jitter)}`;
  },
};
