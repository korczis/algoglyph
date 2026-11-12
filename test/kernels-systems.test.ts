// Every live systems kernel of the catalogue, checked by one harness: generic properties of the
// simulator's trace for all of them, and for each entry an independent check of the property
// its protocol promises, computed here from the run's own record (ADR 0004 §4).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { mulberry32 } from '../src/core/random';
import type { Params } from '../src/core/plate';
import { defaultParams, simulate, type Run, type SystemsKernel } from '../src/engines/systems/sim';
import type { HEvent } from '../src/kernels/systems/_history';
import * as C from '../src/kernels/systems/_crdt';
import * as M from '../src/kernels/systems/_merkle';
import type { CrdtResult } from '../src/kernels/systems/crdt-convergence';
import type { AntiEntropyResult } from '../src/kernels/systems/anti-entropy';
import type { RaftResult } from '../src/kernels/systems/raft-election';
import type { LeaseResult } from '../src/kernels/systems/lease-fencing';
import type { BucketResult } from '../src/kernels/systems/token-bucket';
import { BASE, CAP, WINDOW, type BackoffResult, type Cohort } from '../src/kernels/systems/backoff-jitter';
import type { BreakerResult, BreakerState, Input } from '../src/kernels/systems/circuit-breaker';
import type { Hold, LockResult } from '../src/kernels/systems/ticket-lock-semaphore';
import type { CrawlResult } from '../src/kernels/systems/crawl-frontier';
import type { MerkleResult } from '../src/kernels/systems/merkle-tree';
import type { ScheduleResult } from '../src/kernels/systems/resource-scheduling';

const modules = import.meta.glob<SystemsKernel>('../src/kernels/systems/[!_]*.ts', { import: 'kernel', eager: true });
const live = ENTRIES.filter((e) => e.engine === 'systems' && e.status === 'live');
const kernelOf = (id: string) => modules[`../src/kernels/systems/${id}.ts`];
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];

function run<R>(id: string, over: Params = {}, seed = 1): Run<R> {
  const k = kernelOf(id) as SystemsKernel<R>;
  return simulate(k, defaultParams(k, over), seed);
}

/** Network variants for kernels that expose the network controls. */
const NETS: Params[] = [
  { delay: 40, loss: 0, partition: false },
  { delay: 40, loss: 5, partition: true },
  { delay: 100, loss: 25, partition: true },
  { delay: 10, loss: 40, partition: false },
];

// ---- independent references ---------------------------------------------------------------

/** happened-before by depth-first search over program order and send-to-receipt edges. */
function closure<C>(events: HEvent<C>[]): boolean[][] {
  const m = events.length;
  const next: number[][] = Array.from({ length: m }, () => []);
  const last = new Map<number, number>();
  for (const e of events) {
    const prev = last.get(e.proc);
    if (prev !== undefined) next[prev].push(e.id);
    if (e.from !== undefined) next[e.from].push(e.id);
    last.set(e.proc, e.id);
  }
  return events.map((e) => {
    const seen = new Array<boolean>(m).fill(false);
    const stack = [...next[e.id]];
    while (stack.length) {
      const x = stack.pop()!;
      if (seen[x]) continue;
      seen[x] = true;
      stack.push(...next[x]);
    }
    return seen;
  });
}

function maxOverlap(intervals: [number, number, number][]): number {
  const ev: [number, number][] = [];
  for (const [a, b, w] of intervals) { ev.push([a, w]); ev.push([b, -w]); }
  ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let cur = 0; let max = 0;
  for (const [, d] of ev) { cur += d; max = Math.max(max, cur); }
  return max;
}

function sha256Hex(words: number[]): string {
  const buf = Buffer.alloc(32);
  words.forEach((w, i) => buf.writeUInt32BE(w >>> 0, 4 * i));
  return createHash('sha256').update(buf).digest('hex');
}
const hex = (d: Uint32Array) => Array.from(d, (x) => x.toString(16).padStart(8, '0')).join('');

// ---- one independent check per entry ---------------------------------------------------------

const CHECKS: Record<string, () => void> = {
  'lamport-clocks': () => {
    for (const seed of SEEDS) for (const procs of [2, 3, 4, 6]) {
      const { events } = run<{ events: HEvent<number>[] }>('lamport-clocks', { procs }, seed).result;
      const hb = closure(events);
      for (const a of events) for (const b of events) {
        if (hb[a.id][b.id]) expect(a.clock, `seed ${seed}: e${a.id} -> e${b.id}`).toBeLessThan(b.clock);
      }
    }
  },

  'vector-clocks': () => {
    const leq = (a: number[], b: number[]) => a.every((x, k) => x <= b[k]);
    for (const seed of SEEDS) for (const procs of [2, 3, 5]) {
      const { events } = run<{ events: HEvent<number[]>[] }>('vector-clocks', { procs }, seed).result;
      const hb = closure(events);
      for (const a of events) for (const b of events) {
        if (a.id === b.id) continue;
        const before = leq(a.clock, b.clock) && !leq(b.clock, a.clock);
        expect(before, `seed ${seed}: e${a.id} before e${b.id}`).toBe(hb[a.id][b.id]);
        const concurrent = !leq(a.clock, b.clock) && !leq(b.clock, a.clock);
        expect(concurrent).toBe(!hb[a.id][b.id] && !hb[b.id][a.id]);
      }
    }
  },

  'crdt-convergence': () => {
    // the simulated run: replicas converge to what the global history of writes implies
    for (const seed of SEEDS.slice(0, 5)) for (const net of NETS.slice(0, 3)) {
      const r = run<CrdtResult>('crdt-convergence', net, seed).result;
      const codes = new Set(r.replicas.map(C.encode));
      expect(codes.size, `seed ${seed}`).toBe(1);
      expect(C.value(r.replicas[0])).toBe(r.ops.reduce((s, o) => s + (o.kind === 'inc' ? o.by : 0), 0));
      const removed = new Set(r.ops.flatMap((o) => (o.kind === 'remove' ? o.tags : [])));
      const want = [...new Set(r.ops.filter((o) => o.kind === 'add' && !removed.has(o.tag))
        .map((o) => (o.kind === 'add' ? o.element : '')))].sort();
      expect(C.elements(r.replicas[0])).toEqual(want);
    }
    // property: any delivery order, with duplicates, gives the same state everywhere
    const rnd = mulberry32(99);
    for (let trial = 0; trial < 40; trial++) {
      const R = 2 + Math.floor(rnd() * 4);
      const reps = Array.from({ length: R }, () => C.empty(R));
      let tag = 0;
      for (let k = 0; k < 40; k++) {
        const i = Math.floor(rnd() * R);
        const u = rnd();
        if (u < 0.3) C.increment(reps[i], i, rnd() < 0.5 ? 1 : -1);
        else if (u < 0.6) C.add(reps[i], 'abc'[Math.floor(rnd() * 3)], `${i}.${tag++}`);
        else if (u < 0.8) C.remove(reps[i], 'abc'[Math.floor(rnd() * 3)]);
        else C.merge(reps[i], C.clone(reps[Math.floor(rnd() * R)]));
      }
      const finals = reps.map(C.clone);
      const outcomes = new Set<string>();
      for (let shuffle = 0; shuffle < 6; shuffle++) {
        const copy = finals.map(C.clone);
        const deliveries: [number, number][] = [];
        for (let a = 0; a < R; a++) for (let b = 0; b < R; b++) if (a !== b) deliveries.push([a, b], [a, b]);
        for (let i = deliveries.length - 1; i > 0; i--) {
          const j = Math.floor(rnd() * (i + 1));
          [deliveries[i], deliveries[j]] = [deliveries[j], deliveries[i]];
        }
        // each delivery carries the sender's original state, so order is all that varies
        for (const [a, b] of deliveries) C.merge(copy[b], finals[a]);
        const codes = new Set(copy.map(C.encode));
        expect(codes.size).toBe(1);
        outcomes.add([...codes][0]);
      }
      expect(outcomes.size).toBe(1);
      // the merge is a join: idempotent and commutative
      const [x, y] = [finals[0], finals[R - 1]];
      const xy = C.clone(x); C.merge(xy, y);
      const yx = C.clone(y); C.merge(yx, x);
      expect(C.encode(xy)).toBe(C.encode(yx));
      const xx = C.clone(xy); C.merge(xx, xy);
      expect(C.encode(xx)).toBe(C.encode(xy));
    }
    // "converged" is claimed only once the writes have stopped and every replica agrees; the
    // states are replayed from the trace's own divergence samples, not from the kernel's flag
    for (const seed of [...SEEDS, 55, 89]) for (const net of NETS.slice(0, 3)) {
      const { net: trace } = run<CrdtResult>('crdt-convergence', net, seed);
      let lastWrite = -Infinity; let distinct = NaN;
      const claims: { t: number; distinct: number; lastWrite: number }[] = [];
      for (const e of trace.events) {
        if (e.k === 'count' && e.key === 'writes') lastWrite = e.t;
        if (e.k === 'sample' && e.series === 'distinct replica states') distinct = e.value;
        if (e.k === 'gauge' && e.key === 'converged') claims.push({ t: e.t, distinct, lastWrite });
      }
      expect(claims.length, `seed ${seed}: converged once`).toBe(1);
      for (const c of claims) {
        expect(c.distinct, `seed ${seed}: replicas differ at ${c.t} ms`).toBe(1);
        expect(c.t, `seed ${seed}: converged at ${c.t} ms before the last write`).toBeGreaterThan(c.lastWrite);
      }
      // and no write follows the claim
      const after = trace.events.filter((e) => e.k === 'count' && e.key === 'writes' && e.t >= claims[0].t);
      expect(after.length, `seed ${seed}`).toBe(0);
    }
    // a conflict is an add concurrent with a remove; an add after the remove was seen is not one
    {
      const a = C.empty(2); const b = C.empty(2);
      C.add(a, 'x', 'a1');
      C.merge(b, C.clone(a));
      C.remove(b, 'x');
      expect(C.merge(a, C.clone(b)), 'the remove arrives: no conflict').toEqual([]);
      expect(C.elements(a)).toEqual([]);
      C.add(a, 'x', 'a2'); // sequential: a has seen the remove
      expect(C.merge(b, C.clone(a)), 'a re-add after the remove is not concurrent').toEqual([]);
      expect(C.elements(b)).toEqual(['x']);
    }
    {
      const a = C.empty(2); const b = C.empty(2);
      C.add(a, 'x', 'a1');
      C.merge(b, C.clone(a));
      C.remove(b, 'x');
      C.add(a, 'x', 'a2'); // concurrent: a has not seen b's remove
      expect(C.merge(b, C.clone(a)), 'a concurrent add wins over the remove').toEqual(['x']);
      expect(C.merge(a, C.clone(b)), 'nothing came back at a: it never lost x').toEqual([]);
      expect(C.elements(a)).toEqual(['x']);
    }
  },

  'anti-entropy': () => {
    for (const seed of SEEDS) for (const net of NETS) for (const replicas of [2, 4, 6]) {
      const r = run<AntiEntropyResult>('anti-entropy', { ...net, replicas }, seed).result;
      const label = `seed ${seed} replicas ${replicas} ${JSON.stringify(net)}`;
      for (const h of r.have) expect(h, label).toEqual(r.written);
      expect(r.duplicates, label).toBe(0);
      expect(r.gaps, label).toBe(0);
      expect(r.applied, label).toBe((replicas - 1) * r.written.reduce((s, x) => s + x, 0));
    }
  },

  'raft-election': () => {
    let elected = 0;
    for (const seed of [...SEEDS, 55, 89, 144, 233]) for (const net of NETS) for (const nodes of [3, 5, 7]) {
      const r = run<RaftResult>('raft-election', { ...net, nodes }, seed).result;
      const label = `seed ${seed} nodes ${nodes} ${JSON.stringify(net)}`;
      const leaderOf = new Map<number, number>();
      for (const l of r.leaders) {
        expect(leaderOf.get(l.term) ?? l.node, `${label}: two leaders in term ${l.term}`).toBe(l.node);
        leaderOf.set(l.term, l.node);
        expect(new Set(l.votes).size, label).toBeGreaterThanOrEqual(Math.floor(nodes / 2) + 1);
        for (const v of l.votes) {
          if (v === l.node) continue;
          expect(r.votes.some((x) => x.term === l.term && x.voter === v && x.candidate === l.node), label).toBe(true);
        }
      }
      const ballot = new Map<string, number>();
      for (const v of r.votes) {
        const key = `${v.term}/${v.voter}`;
        expect(ballot.get(key) ?? v.candidate, `${label}: voted twice in term ${v.term}`).toBe(v.candidate);
        ballot.set(key, v.candidate);
        const [ct, ci] = v.candidateLast; const [vt, vi] = v.voterLast;
        expect(ct > vt || (ct === vt && ci >= vi), `${label}: vote for a stale log`).toBe(true);
      }
      elected += r.leaders.length;
    }
    expect(elected).toBeGreaterThan(0);
    // the split-vote and leaderless readouts, recounted from the whole trace after the fact: a
    // split vote is a term with rival candidates (election marks) that no leader mark ever
    // claims, that is over by the end (every node's last term sample is at least it and none is
    // still its candidate), and in which a candidate gave up with a majority in reach (roles
    // replayed from the state events, reachability from the partition)
    let splits = 0; let stale = 0; let lateWins = 0; let wins = 0;
    for (const seed of [...SEEDS, 55, 89]) for (const net of NETS) for (const nodes of [3, 5]) {
      const { net: tr } = run<RaftResult>('raft-election', { ...net, nodes }, seed);
      const majority = Math.floor(nodes / 2) + 1;
      const part = tr.cfg.partition;
      const cut = (a: number, b: number, t: number) => Boolean(part && t >= part.from && t < part.to
        && part.side[a] >= 0 && part.side[b] >= 0 && part.side[a] !== part.side[b]);
      const role = new Array<string>(nodes).fill('follower');
      const since = new Array<number>(nodes).fill(-1);
      const lastTerm = new Array<number>(nodes).fill(0);
      const reach = (i: number, t: number) => role.filter((r, j) => j === i || (r !== 'down' && !cut(i, j, t))).length;
      const stood = new Map<number, Set<number>>(); const won = new Set<number>();
      const gaveUp = new Map<number, number>(); // term -> time a candidate gave up with a majority in reach
      for (const e of tr.events) {
        if (e.k === 'state') { role[e.lane] = e.state; since[e.lane] = e.t; }
        if (e.k === 'sample' && /^node \d+$/.test(e.series)) lastTerm[Number(e.series.slice(5)) - 1] = e.value;
        if (e.k !== 'mark') continue;
        const leader = /^leader T(\d+)$/.exec(e.label);
        if (leader) won.add(Number(leader[1]));
        const start = /^T(\d+)\?$/.exec(e.label);
        if (!start) continue;
        const k = Number(start[1]);
        // a candidate since before this instant gave up on term k - 1
        if (role[e.lane] === 'candidate' && since[e.lane] < e.t && reach(e.lane, e.t) >= majority && !gaveUp.has(k - 1)) gaveUp.set(k - 1, e.t);
        if (!stood.has(k)) stood.set(k, new Set());
        stood.get(k)!.add(e.lane);
      }
      const over = (k: number) => lastTerm.every((x, j) => x > k || (x === k && role[j] !== 'candidate'));
      const lost = [...stood].filter(([k, c]) => c.size > 1 && !won.has(k) && gaveUp.has(k) && over(k));
      // terms a candidate gave up on while rivals were out, and that a delayed vote then won
      lateWins += [...stood].filter(([k, c]) => c.size > 1 && won.has(k) && gaveUp.has(k)).length;
      const counted = tr.events.filter((e) => e.k === 'count' && e.key === 'split').length;
      expect(counted, `seed ${seed} nodes ${nodes} ${JSON.stringify(net)}: split votes`).toBe(lost.length);
      splits += counted;
      wins += won.size;
      // leaderless ticks: counted exactly when no leader reaches a majority (ticks where a role
      // or the partition changes at that very instant are ambiguous and skipped)
      const ticks = new Set<number>(); const changes = new Set<number>();
      for (const e of tr.events) {
        if (e.k === 'count' && e.key === 'leaderless') ticks.add(e.t);
        if (e.k === 'state') changes.add(e.t);
      }
      if (part) { changes.add(part.from); changes.add(part.to); }
      role.fill('follower');
      let at = 0;
      const states = tr.events.filter((e) => e.k === 'state');
      for (let t = 0; t < tr.horizon; t += 10) {
        while (at < states.length && states[at].t < t) {
          const e = states[at++];
          if (e.k === 'state') role[e.lane] = e.state;
        }
        if (changes.has(t)) continue;
        const led = role.some((r, i) => r === 'leader' && reach(i, t) >= majority);
        if (!led && role.includes('leader')) stale++;
        expect(ticks.has(t), `seed ${seed} nodes ${nodes}: leaderless at ${t} ms`).toBe(!led);
      }
    }
    expect(splits, 'some split votes happen').toBeGreaterThan(0);
    expect(splits, 'the note: split votes are fewer than the terms that elect a leader').toBeLessThan(wins);
    expect(lateWins, 'a term given up on and then won by a delayed vote is seen, and not counted').toBeGreaterThan(0);
    expect(stale, 'a stale leader in a minority is seen').toBeGreaterThan(0);
  },

  'lease-fencing': () => {
    let refused = 0; let landed = 0;
    for (const seed of SEEDS) for (const workers of [2, 3, 5]) {
      const r = run<LeaseResult>('lease-fencing', { workers, pause: 25 }, seed).result;
      let max = 0;
      for (const w of r.writes) {
        expect(w.accepted, `seed ${seed}: token ${w.token} after ${max}`).toBe(w.token >= max);
        if (w.accepted) max = w.token;
        else refused++;
      }
      // the service never has two unexpired leases at once
      for (let i = 1; i < r.grants.length; i++) {
        expect(r.grants[i].t).toBeGreaterThanOrEqual(Math.max(...r.grants[i - 1].expires));
        expect(r.grants[i].token).toBe(r.grants[i - 1].token + 1);
      }
      const off = run<LeaseResult>('lease-fencing', { workers, pause: 25, fencing: false }, seed).result;
      let m = 0;
      for (const w of off.writes) { if (w.token < m) landed++; m = Math.max(m, w.token); }
    }
    expect(refused, 'fencing refuses some stale writes').toBeGreaterThan(0);
    expect(landed, 'without fencing some stale writes land').toBeGreaterThan(0);
  },

  'token-bucket': () => {
    for (const seed of SEEDS) for (const [rate, burst, load] of [[12, 8, 30], [5, 1, 60], [40, 20, 120], [60, 3, 10]]) {
      const r = run<BucketResult>('token-bucket', { rate, burst, load }, seed).result;
      const a = r.arrivals.filter((x) => x.admitted).map((x) => x.t);
      for (let i = 0; i < a.length; i++) for (let j = i; j < a.length; j++) {
        expect(j - i + 1).toBeLessThanOrEqual((rate * (a[j] - a[i])) / 1000 + burst + 1e-9);
      }
      // an independent bucket fed the same arrivals makes the same decisions
      let tokens = burst; let at = 0;
      for (const x of r.arrivals) {
        tokens = Math.min(burst, tokens + (rate * (x.t - at)) / 1000);
        at = x.t;
        const ok = tokens >= 1;
        if (ok) tokens--;
        expect(x.admitted).toBe(ok);
      }
    }
  },

  'backoff-jitter': () => {
    const peak = (c: Cohort, from: number) => {
      const bins = new Map<number, number>();
      for (const a of c.attempts) a.slice(1).filter((t) => t >= from).forEach((t) => {
        const b = Math.floor(t / WINDOW); bins.set(b, (bins.get(b) ?? 0) + 1);
      });
      return Math.max(0, ...bins.values());
    };
    for (const seed of SEEDS.slice(0, 5)) for (const clients of [20, 40, 80]) {
      const r = run<BackoffResult>('backoff-jitter', { clients }, seed).result;
      expect(peak(r.jitter, r.outage[1]), `seed ${seed}`).toBeLessThan(peak(r.lockstep, r.outage[1]));
      expect(r.jitter.done.length).toBe(clients);
      if (r.lockstep.done.length === clients) expect(Math.max(...r.jitter.done)).toBeLessThan(Math.max(...r.lockstep.done));
      for (const d of r.jitter.delays) {
        expect(d.sleep).toBeGreaterThanOrEqual(0);
        expect(d.sleep).toBeLessThan(Math.min(CAP, BASE * 2 ** d.attempt));
      }
      for (const d of r.lockstep.delays) expect(d.sleep).toBe(Math.min(CAP, BASE * 2 ** d.attempt));
    }
  },

  'circuit-breaker': () => {
    // the table, written out
    const table = (s: BreakerState, i: Input, f: number, th: number): BreakerState => ({
      closed: { success: 'closed', failure: f + 1 >= th ? 'open' : 'closed', cooldown: 'closed' },
      open: { success: 'open', failure: 'open', cooldown: 'half-open' },
      'half-open': { success: 'closed', failure: 'open', cooldown: 'half-open' },
    } as Record<BreakerState, Record<Input, BreakerState>>)[s][i];
    for (const seed of SEEDS) for (const [threshold, cooldown] of [[4, 500], [1, 200], [8, 1500]]) {
      const r = run<BreakerResult>('circuit-breaker', { threshold, cooldown }, seed);
      const ts = r.result.transitions;
      ts.forEach((x, i) => {
        expect(x.to).toBe(table(x.from, x.input, x.failures, threshold));
        if (i) expect(x.from).toBe(ts[i - 1].to);
      });
      expect(ts.some((x) => x.to === 'open')).toBe(true);
      // no call reaches the dependency while the breaker is open
      const states = r.net.events.filter((e) => e.k === 'state' && e.lane === 1);
      const at = (t: number) => {
        let s = 'closed';
        for (const e of states) if (e.k === 'state' && e.t <= t) s = e.state;
        return s;
      };
      for (const e of r.net.events) if (e.k === 'msg' && e.from === 1 && e.to === 2) expect(at(e.t0)).not.toBe('open');
      expect(kernelOf('circuit-breaker').verdict?.(r.result, r.net)).toMatch(/no call forwarded while open$/);
    }
    // the verdict reads the trace, so it can fail: a call slipped through an open breaker shows
    const r = run<BreakerResult>('circuit-breaker', {}, 1);
    const open = r.net.events.findIndex((e) => e.k === 'state' && e.lane === 1 && e.state === 'open');
    const leak = { ...r.net.events.find((e) => e.k === 'msg' && e.from === 1 && e.to === 2)! };
    r.net.events.splice(open + 1, 0, leak);
    expect(kernelOf('circuit-breaker').verdict?.(r.result, r.net)).toBe('1 call forwarded while open');
  },

  'ticket-lock-semaphore': () => {
    for (const seed of SEEDS) for (const [workers, slots] of [[5, 2], [8, 1], [3, 3], [8, 4]]) {
      const r = run<LockResult>('ticket-lock-semaphore', { workers, slots }, seed).result;
      const lock = r.lock.slice().sort((a, b) => a.ticket! - b.ticket!);
      const got = lock.filter((h) => !Number.isNaN(h.granted));
      for (let i = 1; i < lock.length; i++) expect(lock[i].asked).toBeGreaterThanOrEqual(lock[i - 1].asked);
      for (let i = 1; i < got.length; i++) {
        expect(got[i].ticket).toBe(got[i - 1].ticket! + 1);
        // FIFO and mutual exclusion: the next holder starts after the previous one released
        expect(got[i].granted).toBeGreaterThan(got[i - 1].released);
      }
      const held = (h: Hold) => !Number.isNaN(h.granted);
      const iv = r.slots.filter(held).map((h) => [h.granted, Number.isNaN(h.released) ? Infinity : h.released, 1] as [number, number, number]);
      expect(maxOverlap(iv)).toBeLessThanOrEqual(slots);
      const s = r.slots;
      for (const a of s) for (const b of s) {
        if (a.asked < b.asked && held(b)) expect(held(a) && a.granted <= b.granted).toBe(true);
      }
    }
  },

  'crawl-frontier': () => {
    for (const seed of SEEDS) for (const [hosts, crawlers, politeness] of [[4, 3, 180], [2, 5, 60], [6, 1, 300]]) {
      const r = run<CrawlResult>('crawl-frontier', { hosts, crawlers, politeness }, seed).result;
      const reach = new Set(r.seeds); const q = [...r.seeds];
      while (q.length) for (const l of r.pages[q.shift()!].links) if (!reach.has(l)) { reach.add(l); q.push(l); }
      const fetched = r.fetches.map((f) => f.page);
      expect(new Set(fetched).size, 'each page once').toBe(fetched.length);
      expect(fetched.slice().sort((a, b) => a - b)).toEqual([...reach].sort((a, b) => a - b));
      for (let h = 0; h < hosts; h++) {
        const f = r.fetches.filter((x) => x.host === h);
        for (let i = 1; i < f.length; i++) {
          expect(f[i].start - f[i - 1].start).toBeGreaterThanOrEqual(politeness);
          expect(f[i].start).toBeGreaterThanOrEqual(f[i - 1].end);
        }
        expect(f.map((x) => x.page)).toEqual(r.discovered.filter((p) => r.pages[p].host === h));
      }
    }
  },

  'merkle-tree': () => {
    // the hashes are SHA-256 of the exact 32 bytes, as node:crypto computes them
    const data = [1, 2, 3, 4, 5, 6];
    expect(hex(M.leafHash(7, data))).toBe(sha256Hex([0x6c656166, 7, ...data]));
    const l = M.leafHash(0, data); const r0 = M.leafHash(1, data);
    expect(hex(M.nodeHash(l, r0))).toBe(sha256Hex([...l.slice(0, 4), ...r0.slice(0, 4)]));
    expect(hex(M.linkHash(null, [9, 8, 7, 6]))).toBe(sha256Hex([0, 0, 0, 0, 9, 8, 7, 6]));
    // the root moves with any change to any leaf, and every proof verifies
    const rnd = mulberry32(5);
    const blocks = Array.from({ length: 16 }, () => Array.from({ length: 6 }, () => Math.floor(rnd() * 2 ** 32)));
    const tree = M.build(blocks);
    const root = hex(M.root(tree));
    for (let i = 0; i < blocks.length; i++) {
      const path = M.proof(tree, i);
      expect(M.verify(M.root(tree), i, blocks[i], path)).toBe(true);
      expect(M.verify(M.root(tree), i ^ 1, blocks[i], path)).toBe(false);
      for (const bit of [0, 13, 31]) {
        const b = blocks.map((x) => x.slice());
        b[i][i % 6] ^= 1 << bit;
        expect(hex(M.root(M.build(b)))).not.toBe(root);
        expect(M.verify(M.root(tree), i, b[i], path)).toBe(false);
      }
    }
    // a hash chain: an edit is found where it was made; so is a rewrite, against anchors
    for (let k = 0; k < 12; k++) {
      const chain: M.Link[] = [];
      for (let i = 0; i < 12; i++) M.append(chain, [i, i * 3, 7, 1]);
      const anchors = new Map(chain.map((x, i) => [i, x.hash.slice()]));
      expect(M.audit(chain, anchors)).toBe(-1);
      const edited = chain.map((x) => ({ payload: x.payload.slice(), hash: x.hash }));
      edited[k].payload[2] ^= 4;
      expect(M.audit(edited)).toBe(k);
      for (let i = k; i < edited.length; i++) edited[i].hash = M.linkHash(i ? edited[i - 1].hash : null, edited[i].payload);
      expect(M.audit(edited), 'a rewrite is consistent on its own').toBe(-1);
      expect(M.audit(edited, anchors)).toBe(k);
    }
    // the simulated repair moves exactly the differing blocks; the audit finds the tampering
    for (const seed of SEEDS) for (const tamper of ['edit', 'rewrite']) for (const [depth, changed] of [[4, 3], [2, 4], [6, 8], [3, 0]]) {
      const r = run<MerkleResult>('merkle-tree', { depth, changed, tamper }, seed).result;
      expect(r.transferred.slice().sort((a, b) => a - b)).toEqual(r.differing);
      expect(r.rootsEqual).toBe(true);
      expect(r.tamperedAt).toBeGreaterThanOrEqual(0);
      expect(r.detectedAt).toBe(r.tamperedAt);
    }
  },

  'resource-scheduling': () => {
    for (const seed of SEEDS) for (const [tasks, units] of [[18, 4], [30, 2], [8, 8], [25, 5]]) {
      const r = run<ScheduleResult>('resource-scheduling', { tasks, units }, seed).result;
      const T = r.tasks;
      // bottom levels, recomputed by memoised recursion over successors
      const memo = new Map<number, number>();
      const bottom = (i: number): number => {
        if (!memo.has(i)) memo.set(i, T[i].dur + Math.max(0, ...T.filter((s) => s.preds.includes(i)).map((s) => bottom(s.id))));
        return memo.get(i)!;
      };
      for (const t of T) {
        expect(t.prio).toBe(bottom(t.id));
        expect(Number.isFinite(t.finish)).toBe(true);
        expect(t.finish - t.start).toBe(t.dur);
        for (const q of t.preds) expect(t.start).toBeGreaterThanOrEqual(T[q].finish);
        expect(t.units.length).toBe(t.demand);
      }
      expect(maxOverlap(T.map((t) => [t.start, t.finish, t.demand]))).toBeLessThanOrEqual(units);
      for (let u = 0; u < units; u++) {
        const iv = T.filter((t) => t.units.includes(u)).map((t) => [t.start, t.finish, 1] as [number, number, number]);
        expect(maxOverlap(iv)).toBeLessThanOrEqual(1);
      }
      // non-delay: after each decision, no waiting ready task fits in the units left free
      for (const d of r.decisions) for (const w of d.waiting) expect(T[w].demand).toBeGreaterThan(d.free);
      const end = Math.max(...T.map((t) => t.finish));
      expect(end).toBeGreaterThanOrEqual(Math.max(...T.map((t) => bottom(t.id))));
      expect(end * units).toBeGreaterThanOrEqual(T.reduce((s, t) => s + t.dur * t.demand, 0));
    }
  },
};

describe('systems kernels', () => {
  it('every live systems entry has its kernel and every kernel its entry', () => {
    const files = Object.keys(modules).map((f) => f.replace(/^.*\/(.*)\.ts$/, '$1')).sort();
    expect(files).toEqual(live.map((e) => e.id).sort());
  });

  for (const e of live) {
    const kernel = kernelOf(e.id);
    describe(e.id, () => {
      it('records a deterministic, time-ordered trace that respects the network', () => {
        const variants = kernel.network ? NETS : [{}];
        for (const v of variants) for (const seed of SEEDS.slice(0, 4)) {
          const a = simulate(kernel, defaultParams(kernel, v), seed);
          const b = simulate(kernel, defaultParams(kernel, v), seed);
          expect(a.net.truncated).toBe(false);
          expect(a.net.events.length).toBe(b.net.events.length);
          expect(kernel.verdict?.(a.result, a.net)).toBe(kernel.verdict?.(b.result, b.net));
          const st = a.net.stamps;
          for (let i = 1; i < st.length; i++) expect(st[i]).toBeGreaterThanOrEqual(st[i - 1]);
          const lanes = a.net.lanes.length;
          const part = a.net.cfg.partition;
          for (const m of a.net.events) {
            if (m.k !== 'msg') continue;
            expect(m.from).toBeLessThan(lanes);
            expect(m.to).toBeLessThan(lanes);
            expect(m.t1).toBeGreaterThanOrEqual(m.t0);
            if (m.fate === 0 && part) {
              const cut = (t: number) => t >= part.from && t < part.to && part.side[m.from] >= 0
                && part.side[m.to] >= 0 && part.side[m.from] !== part.side[m.to];
              expect(cut(m.t0) || cut(m.t1), 'delivered across a partition').toBe(false);
            }
          }
          for (const d of kernel.readouts) expect(typeof d.label).toBe('string');
        }
      });

      it('keeps the property its protocol promises', () => {
        expect(CHECKS[e.id], `no independent check for ${e.id}`).toBeTypeOf('function');
        CHECKS[e.id]();
      });
    });
  }
});
