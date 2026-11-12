import { num } from '../../core/plate';
import type { SystemsKernel } from '../../engines/systems/sim';

// Pull anti-entropy with high-water marks. Every replica holds, per origin, a contiguous
// prefix of that origin's writes, so a vector of prefix lengths summarises what it has. In a
// session replica A locks itself and sends its marks to a random peer B, which replies with
// exactly the writes above them; A applies them and unlocks. Answering never changes B, so B
// answers whatever else it is doing. A runs one session at a time, waits at most two maximal
// delays for the answer, changes only through its own sessions and writes, and is never sent
// its own writes, so nothing it is sent was already known to it: no write is sent twice.

export interface AntiEntropyResult {
  /** have[r][o]: how many of origin o's writes replica r holds. */
  have: number[][];
  written: number[];
  duplicates: number;
  gaps: number;
  applied: number;
  convergedAt: number;
}

export const kernel: SystemsKernel<AntiEntropyResult> = {
  network: true,
  params: [
    { kind: 'range', key: 'replicas', label: 'Replicas', min: 2, max: 6, step: 1, value: 4, rebuild: true },
    // at most 40: writing longer only adds writes and transfers, and the run was already at its
    // heaviest; at least 35, so that both sides still write inside the partition from 30%
    { kind: 'range', key: 'writeStop', label: 'Writes stop at (% of run)', min: 35, max: 40, step: 5, value: 40, rebuild: true },
  ],
  setup: (p) => ({
    lanes: Array.from({ length: num(p, 'replicas') }, (_, i) => `replica ${String.fromCharCode(65 + i)}`),
    horizon: 10000,
  }),
  install(net, p) {
    const R = num(p, 'replicas');
    const have = Array.from({ length: R }, () => new Array<number>(R).fill(0));
    const written = new Array<number>(R).fill(0);
    const res: AntiEntropyResult = { have, written, duplicates: 0, gaps: 0, applied: 0, convergedAt: NaN };
    const busy = new Array<boolean>(R).fill(false);
    const lockTimer: (ReturnType<typeof net.at> | null)[] = new Array(R).fill(null);
    const wait = 2 * net.cfg.delay[1] + 5;
    // (writeStop / 100) first: 40 / 100 is the double 0.4, so the default stops where it did
    const writeUntil = net.horizon * (Number(p.writeStop ?? 40) / 100);

    const lock = (i: number) => {
      busy[i] = true;
      net.state(i, 'in session');
      lockTimer[i] = net.after(wait, () => unlock(i, true));
    };
    const unlock = (i: number, timedOut = false) => {
      if (!busy[i]) return;
      net.cancel(lockTimer[i]);
      busy[i] = false;
      net.state(i, '');
      if (timedOut) { net.count('timeouts'); net.mark(i, 'timeout', 0.1); }
    };
    // the writes of `from` above the marks of replica `to`, origin by origin, in order; never
    // `to`'s own writes, which it may have written since its marks were taken
    const delta = (from: number, to: number, marks: number[]) => {
      const out: [number, number][] = [];
      for (let o = 0; o < R; o++) {
        if (o === to) continue;
        for (let s = marks[o] + 1; s <= have[from][o]; s++) out.push([o, s]);
      }
      return out;
    };
    const apply = (to: number, entries: [number, number][]) => {
      for (const [o, s] of entries) {
        if (s <= have[to][o]) { res.duplicates++; net.count('duplicates'); continue; }
        if (s !== have[to][o] + 1) { res.gaps++; net.count('gaps'); continue; }
        have[to][o] = s;
        res.applied++;
        net.count('entries');
      }
    };

    const write = (i: number) => {
      if (net.now > writeUntil) return;
      written[i]++;
      have[i][i] = written[i];
      net.count('writes');
      net.mark(i, `w${written[i]}`, 0.8);
      net.after(net.uniform(120, 420), () => write(i));
    };
    const session = (a: number) => {
      net.after(net.uniform(40, 120), () => session(a));
      if (busy[a] || R < 2) return;
      let b = Math.floor(net.rnd() * (R - 1));
      if (b >= a) b++;
      lock(a);
      net.count('sessions');
      const marksA = have[a].slice();
      net.send(a, b, 'summary', () => {
        // answering never changes B, so B serves pulls whatever else it is doing
        const d = delta(b, a, marksA);
        net.send(b, a, `${d.length} writes`, () => {
          if (!busy[a]) return;
          apply(a, d);
          unlock(a);
        }, { quiet: !d.length });
      });
    };
    const total = () => written.reduce((s, x) => s + x, 0);
    const watch = () => {
      const T = total();
      let missing = 0;
      for (let r = 0; r < R; r++) for (let o = 0; o < R; o++) missing += written[o] - have[r][o];
      net.sample('writes missing across replicas', missing);
      if (missing === 0 && net.now > writeUntil && Number.isNaN(res.convergedAt) && T > 0) {
        res.convergedAt = net.now;
        net.gauge('converged', net.now);
        net.mark(0, 'converged', 0.95);
      }
      net.after(25, watch);
    };
    for (let i = 0; i < R; i++) {
      net.after(net.uniform(0, 150), () => write(i));
      net.after(net.uniform(0, 120), () => session(i));
    }
    net.after(0, watch);
    return res;
  },
  readouts: [
    { key: 'writes', label: 'Writes' },
    { key: 'sessions', label: 'Sessions started' },
    { key: 'entries', label: 'Writes transferred' },
    { key: 'duplicates', label: 'Duplicates received' },
    { key: 'timeouts', label: 'Session timeouts' },
    { key: 'converged', kind: 'gauge', label: 'Converged at', unit: ' ms' },
  ],
  chart: { title: 'Writes still missing somewhere', y: 'writes' },
  verdict(r) {
    const T = r.written.reduce((s, x) => s + x, 0);
    const R = r.written.length;
    const ok = r.have.every((h) => h.every((x, o) => x === r.written[o]));
    return ok ? `converged; ${r.applied} transfers = (replicas − 1) × writes = ${(R - 1) * T}, ${r.duplicates} duplicates`
      : 'not yet converged';
  },
};
