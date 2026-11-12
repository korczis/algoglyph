import { num } from '../../core/plate';
import type { SystemsKernel } from '../../engines/systems/sim';

// A breadth-first crawl of a seeded link graph across several hosts, by a few crawler workers.
// The frontier keeps one FIFO queue per host and, for each host, the earliest time it may be
// contacted again: the previous fetch's start plus the politeness delay, and never while a
// fetch to it is still out. A free worker takes the head of the queue of the host that has been
// ready longest; links it brings back that were never seen before join their host's queue.

export interface Page { host: number; links: number[] }
export interface Fetch { page: number; host: number; worker: number; start: number; end: number }
export interface CrawlResult { pages: Page[]; seeds: number[]; fetches: Fetch[]; discovered: number[]; delay: number }

const PER_HOST = 14;

/** A seeded web: pages on each host link mostly within it and sometimes across. */
export function web(hosts: number, rnd: () => number): Page[] {
  const pages: Page[] = [];
  for (let h = 0; h < hosts; h++) for (let k = 0; k < PER_HOST; k++) pages.push({ host: h, links: [] });
  for (let i = 0; i < pages.length; i++) {
    const deg = 1 + Math.floor(rnd() * 4);
    for (let d = 0; d < deg; d++) {
      const h = rnd() < 0.65 ? pages[i].host : Math.floor(rnd() * hosts);
      pages[i].links.push(h * PER_HOST + Math.floor(rnd() * PER_HOST));
    }
  }
  return pages;
}

export const kernel: SystemsKernel<CrawlResult> = {
  params: [
    { kind: 'range', key: 'hosts', label: 'Hosts', min: 2, max: 6, step: 1, value: 4, rebuild: true },
    { kind: 'range', key: 'crawlers', label: 'Crawler workers', min: 1, max: 5, step: 1, value: 3, rebuild: true },
    { kind: 'range', key: 'politeness', label: 'Politeness delay per host (ms)', min: 20, max: 600, step: 10, value: 180, rebuild: true },
  ],
  setup: (p) => ({
    lanes: [
      ...Array.from({ length: num(p, 'crawlers') }, (_, i) => `crawler ${i + 1}`),
      ...Array.from({ length: num(p, 'hosts') }, (_, i) => `host ${String.fromCharCode(97 + i)}`),
    ],
    horizon: 20000,
    window: 3000,
    fit: true,
    net: { delay: [5, 20] },
  }),
  install(net, p) {
    const H = num(p, 'hosts'); const C = num(p, 'crawlers'); const delay = num(p, 'politeness');
    const pages = web(H, net.rnd);
    const seeds = [0];
    const res: CrawlResult = { pages, seeds, fetches: [], discovered: [], delay };
    const seen = new Set<number>();
    const queues: number[][] = Array.from({ length: H }, () => []);
    const nextOk = new Array<number>(H).fill(0);
    const inFlight = new Array<boolean>(H).fill(false);
    // the start of each host's previous fetch, and the closest two starts on one host so far
    const lastStart = new Array<number>(H).fill(NaN);
    let closest = Infinity;
    net.gauge('delay', delay);
    let frontier = 0;
    let fetched = 0;
    const discover = (pg: number) => {
      if (seen.has(pg)) { net.count('dupes'); return; }
      seen.add(pg);
      res.discovered.push(pg);
      queues[pages[pg].host].push(pg);
      frontier++;
      net.count('discovered');
    };
    for (const s of seeds) discover(s);
    const idle: number[] = [];
    const pick = (): number => {
      let best = -1;
      for (let h = 0; h < H; h++) {
        if (!queues[h].length || inFlight[h] || nextOk[h] > net.now) continue;
        if (best < 0 || nextOk[h] < nextOk[best]) best = h;
      }
      return best;
    };
    const wake = () => { for (const w of idle.splice(0)) work(w); };
    let wakeTimer: ReturnType<typeof net.at> | null = null;
    const work = (w: number) => {
      const h = pick();
      if (h < 0) {
        net.state(w, '');
        idle.push(w);
        // the crawl is over when every crawler is idle and the frontier is empty
        if (idle.length === C && frontier === 0) {
          net.gauge('finished', net.now);
          net.stop();
          return;
        }
        // sleep until the earliest host with work becomes contactable
        const times = queues.map((q, i) => (q.length && !inFlight[i] ? nextOk[i] : Infinity));
        const soon = Math.min(...times);
        if (Number.isFinite(soon) && (!wakeTimer || soon < wakeTimer.t)) {
          net.cancel(wakeTimer);
          wakeTimer = net.at(soon, () => { wakeTimer = null; wake(); });
        }
        return;
      }
      const pg = queues[h].shift()!;
      frontier--;
      inFlight[h] = true;
      nextOk[h] = net.now + delay;
      const gap = net.now - lastStart[h];
      if (gap < closest) { closest = gap; net.gauge('closest', closest); }
      lastStart[h] = net.now;
      const f: Fetch = { page: pg, host: h, worker: w, start: net.now, end: NaN };
      res.fetches.push(f);
      net.state(w, `fetch ${String.fromCharCode(97 + h)}${pg % PER_HOST}`);
      net.gauge('frontier', frontier);
      net.sample('frontier size', frontier);
      net.send(w, C + h, 'GET', () => {
        net.after(net.uniform(10, 40), () => {
          net.send(C + h, w, `${pages[pg].links.length} links`, () => {
            f.end = net.now;
            inFlight[h] = false;
            net.count('fetched');
            net.sample('pages fetched', ++fetched);
            for (const l of pages[pg].links) discover(l);
            net.gauge('frontier', frontier);
            net.sample('frontier size', frontier);
            wake();
            work(w);
          }, { reliable: true });
        });
      }, { reliable: true });
    };
    for (let w = 0; w < C; w++) net.after(w, () => work(w));
    return res;
  },
  readouts: [
    { key: 'fetched', label: 'Pages fetched' },
    { key: 'discovered', label: 'Pages discovered' },
    { key: 'dupes', label: 'Links to pages already seen' },
    { key: 'frontier', kind: 'gauge', label: 'Frontier size' },
    { key: 'finished', kind: 'gauge', label: 'Crawl finished at', unit: ' ms' },
    { key: 'closest', kind: 'gauge', label: 'Closest two hits on one host', unit: ' ms' },
    { key: 'delay', kind: 'gauge', label: 'Politeness delay per host', unit: ' ms' },
  ],
  chart: { title: 'Frontier and pages fetched', y: 'pages', series: ['frontier size', 'pages fetched'] },
  verdict(r) {
    const byHost = new Map<number, number[]>();
    for (const f of r.fetches) {
      if (!byHost.has(f.host)) byHost.set(f.host, []);
      byHost.get(f.host)!.push(f.start);
    }
    let gap = Infinity;
    for (const ts of byHost.values()) for (let i = 1; i < ts.length; i++) gap = Math.min(gap, ts[i] - ts[i - 1]);
    const done = r.fetches.filter((f) => !Number.isNaN(f.end)).length;
    return `${done} of ${r.discovered.length} discovered pages fetched; closest two hits on one host ${Number.isFinite(gap) ? gap.toFixed(0) : '–'} ms apart (delay ${r.delay} ms)`;
  },
};
