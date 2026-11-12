// Every live hash kernel of the catalogue, checked by one harness against references that do not
// come from the code under test: a Map for membership, probe counts recounted from the final
// table with hash functions written out again here, and the structural invariants of resizing
// tables and extendible directories (ADR 0004 §4).
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { mulberry32 } from '../src/core/random';
import { PALETTES } from '../src/core/palette';
import type { ParamDef, Params, PlateCode, PlateContext } from '../src/core/plate';
import { p5Stub } from './support/p5-stub';
import { drawTable, engine, exponent, FRAME_EVENTS, pageRuns, Rebuild, Replay, Scaling, SCALING_N } from '../src/engines/hash/index';
import { apply, EMPTY, KIND, keysOf, MAX_DEPTH, OP, STRIDE, Table, trace, type HashKernel, type Size,
  type Step, type Trace } from '../src/engines/hash/table';
import { keys, STREAMS, workload, type Stream } from '../src/engines/hash/workload';

const modules = import.meta.glob<HashKernel>('../src/kernels/hash/[!_]*.ts', { import: 'kernel', eager: true });
const live = ENTRIES.filter((e) => e.engine === 'hash' && e.status === 'live');
const kernelOf = (id: string) => modules[`../src/kernels/hash/${id}.ts`];

// the hash functions, written out independently of src/engines/hash/table.ts
const H1 = (k: number) => Number((BigInt(k) * 0x9e3779b1n) % 2n ** 32n);
const H2 = (k: number) => {
  let h = BigInt(k);
  const M = 2n ** 32n;
  h ^= h >> 16n; h = (h * 0x85ebca6bn) % M;
  h ^= h >> 13n; h = (h * 0xc2b2ae35n) % M;
  h ^= h >> 16n;
  return Number(h);
};
const home = (h: number, m: number) => Number((BigInt(h) * BigInt(m)) >> 32n);
const lead = (h: number, g: number) => (g === 0 ? 0 : Number(BigInt(h) >> BigInt(32 - g)));

interface Result { kind: number; key: number; ok: boolean; probes: number; loads: number; recorded: number }

/** The operations of a trace, read from its events alone. */
function results(t: Trace): Result[] {
  const out: Result[] = [];
  let key = 0; let recorded = 0;
  for (let e = 0; e < t.length; e++) {
    const o = STRIDE * e;
    const op = t.events[o];
    if (op === OP.begin) { key = t.events[o + 2]; recorded = 0; } else if (op === OP.probe) recorded++;
    else if (op === OP.end) {
      out.push({ kind: t.events[o + 1], key, ok: t.events[o + 2] === 1, probes: t.events[o + 3],
        loads: t.events[o + 4], recorded });
    }
  }
  return out;
}

/** Replay a trace, calling `each` with the table after every operation. */
function replay(t: Trace, each: (table: Table, r: number) => void): Table {
  const table = new Table();
  let r = 0;
  for (let e = 0; e < t.length; e++) {
    apply(table, t.events, e);
    if (t.events[STRIDE * e] === OP.end) each(table, r++);
  }
  return table;
}

/** A random sequence of inserts, searches and deletes over a universe of keys. */
function randomSteps(stream: Stream, n: number, seed: number): { steps: Step[]; universe: number[] } {
  const { inserted, absent } = keys(stream, Math.max(1, n), seed);
  const universe = [...inserted, ...absent].slice(0, Math.max(1, 2 * n));
  const rnd = mulberry32(seed + 1);
  const steps: Step[] = [];
  for (let i = 0; i < 4 * n; i++) {
    const u = rnd();
    const kind = u < 0.45 ? KIND.insert : u < 0.75 ? KIND.search : KIND.remove;
    steps.push({ kind, key: universe[Math.floor(rnd() * universe.length)] });
  }
  return { steps, universe };
}

/** Probes a search for key must take in the final table, recounted from its layout. */
const RECOUNT: Record<string, (t: Table, key: number, pageSize: number) => { probes: number; loads: number }> = {
  'linear-probing': linear,
  'dynamic-hash-table': linear,
  'double-hashing'(t, key) {
    const m = t.m;
    let i = home(H1(key), m);
    const step = 1 + (H2(key) % (m - 1));
    for (let d = 1; d <= m; d++) {
      const v = t.value(i, 0);
      if (v === key || v === EMPTY) return { probes: d, loads: 0 };
      i = (i + step) % m;
    }
    return { probes: m, loads: 0 };
  },
  'separate-chaining'(t, key) {
    const chain = t.buckets[home(H1(key), t.m)];
    const at = chain.indexOf(key);
    return { probes: at >= 0 ? at + 1 : chain.length, loads: 0 };
  },
  'extendible-hashing'(t, key) {
    const page = t.buckets[t.dir[lead(H1(key), t.globalDepth)]];
    const at = page.indexOf(key);
    return { probes: at >= 0 ? at + 1 : page.length, loads: 1 };
  },
};

function linear(t: Table, key: number) {
  const m = t.m;
  const i = home(H1(key), m);
  for (let d = 0; d < m; d++) {
    const v = t.value((i + d) % m, 0);
    if (v === key || v === EMPTY) return { probes: d + 1, loads: 0 };
  }
  return { probes: m, loads: 0 };
}

const SIZES = [0, 1, 2, 7, 64, 200];

function sizeFor(n: number, load = 0.9): Size {
  return { n, m: Math.max(1, Math.ceil(n / load)), pageSize: 4 };
}

describe('hash kernels', () => {
  it('every live hash entry has its kernel and every kernel its entry', () => {
    const files = Object.keys(modules).map((f) => f.replace(/^.*\/(.*)\.ts$/, '$1')).sort();
    expect(files).toEqual(live.map((e) => e.id).sort());
  });

  it('every live hash kernel has an independent probe recount', () => {
    for (const e of live) expect(RECOUNT[e.id], e.id).toBeTypeOf('function');
  });

  for (const e of live) {
    const kernel = kernelOf(e.id);
    describe(e.id, () => {
      it('answers every insert, search and delete as a Map does, and ends holding its keys', () => {
        for (const stream of STREAMS) {
          for (const n of SIZES) {
            // a random mix over twice as many keys as n, with room for all of them
            const { steps } = randomSteps(stream, n, 300 + n);
            const t = trace(kernel, steps, sizeFor(2 * n + 1, 0.95));
            expect(t.truncated).toBe(false);
            const ref = new Map<number, true>();
            const got = results(t);
            expect(got.length).toBe(steps.length);
            steps.forEach((s, i) => {
              if (s.kind === 'check') return;
              const want = s.kind === KIND.insert ? !ref.has(s.key) && Boolean(ref.set(s.key, true))
                : s.kind === KIND.search ? ref.has(s.key) : ref.delete(s.key);
              expect(got[i].ok, `${stream} n=${n} step ${i}`).toBe(want);
            });
            expect(keysOf(t.table).sort((a, b) => a - b)).toEqual([...ref.keys()].sort((a, b) => a - b));
            expect(t.table.count).toBe(ref.size);
            // the replay rebuilds exactly the table the run left
            const again = replay(t, () => {});
            expect(again.buckets).toEqual(t.table.buckets);
            expect(again.dir).toEqual(t.table.dir);
          }
        }
      });

      it("runs the plate's workload with every measured search answered correctly", () => {
        for (const stream of STREAMS) {
          const steps = workload(stream, 120, 60, 17);
          const t = trace(kernel, steps, sizeFor(120, 0.8));
          const ref = new Set<number>();
          const ops = steps.filter((s) => s.kind !== 'check');
          results(t).forEach((r, i) => {
            const s = ops[i] as { kind: number; key: number };
            expect(r.key).toBe(s.key);
            if (s.kind === KIND.insert) { expect(r.ok).toBe(!ref.has(s.key)); ref.add(s.key); }
            else if (s.kind === KIND.search) expect(r.ok, `${stream} search ${s.key}`).toBe(ref.has(s.key));
            else { expect(r.ok).toBe(ref.has(s.key)); ref.delete(s.key); }
          });
        }
      });

      it('reports each operation\'s probes as the probe events inside it, and totals as events', () => {
        const t = trace(kernel, workload('uniform', 200, 50, 5), sizeFor(200, 0.75));
        for (const r of results(t)) expect(r.probes).toBe(r.recorded);
        const tally = (op: number) => {
          let c = 0;
          for (let e = 0; e < t.length; e++) if (t.events[STRIDE * e] === op) c++;
          return c;
        };
        expect(t.counts.probes).toBe(tally(OP.probe));
        expect(t.counts.hashes).toBe(tally(OP.hash));
        expect(t.counts.writes).toBe(tally(OP.write));
        expect(t.counts.loads).toBe(tally(OP.load));
        expect(t.counts.doublings).toBe(tally(OP.double));
      });

      it('takes exactly the probes a recount from the final table predicts', () => {
        for (const stream of STREAMS) {
          const base = workload(stream, 160, 40, 23);
          const { absent } = keys(stream, 160, 23);
          const ins = base.filter((s) => s.kind === KIND.insert).map((s) => (s as { key: number }).key);
          const searches: Step[] = [...ins, ...absent.slice(0, 80)].map((key) => ({ kind: KIND.search, key }));
          const t = trace(kernel, [...base, ...searches], sizeFor(160, 0.8));
          const tail = results(t).slice(-searches.length);
          for (const r of tail) {
            const want = RECOUNT[e.id](t.table, r.key, 4);
            expect(r.probes, `${stream} ${r.key}`).toBe(want.probes);
            expect(r.loads).toBe(want.loads);
          }
        }
      });

      if (kernel.layout !== 'pages') {
        it('never holds more keys than slots in open addressing', () => {
          if (kernel.layout !== 'slots') return;
          const t = trace(kernel, workload('adversarial', 200, 30, 9), sizeFor(200, 0.95));
          replay(t, (table) => expect(table.count + table.tombstones).toBeLessThanOrEqual(table.m));
        });
      }

      if (e.tags.includes('resizing')) {
        it('keeps the load factor between 1/8 and 1/2 after every resize', () => {
          for (const stream of STREAMS) {
            const t = trace(kernel, workload(stream, 300, 90, 31), sizeFor(300));
            let first = 0;
            let resized = 0;
            for (let ev = 0; ev < t.length; ev++) {
              if (t.events[STRIDE * ev] === OP.resize) { first ||= t.events[STRIDE * ev + 1]; resized++; }
            }
            expect(resized).toBeGreaterThan(2);
            replay(t, (table) => {
              const a = table.count / table.m;
              expect(a).toBeLessThanOrEqual(0.5);
              if (table.m > first) expect(a).toBeGreaterThanOrEqual(1 / 8);
            });
          }
        });
      }

      if (kernel.layout === 'pages') {
        it('keeps a directory of 2^g entries over pages no deeper than g, each with its prefix', () => {
          for (const stream of STREAMS) {
            for (const B of [2, 4, 8]) {
              const t = trace(kernel, workload(stream, 200, 50, 41), { n: 200, m: 1, pageSize: B });
              let checked = 0;
              replay(t, (table, r) => {
                if (r % 25) return;
                checked++;
                const g = table.globalDepth;
                expect(table.dir.length).toBe(2 ** g);
                // one pass over the directory: each page's first entry and how many point at it
                const bad: string[] = [];
                const first = new Map<number, number>();
                const refs = new Map<number, number>();
                for (let i = 0; i < table.dir.length; i++) {
                  const pg = table.dir[i];
                  if (!first.has(pg)) first.set(pg, i);
                  else if (table.dir[i - 1] !== pg) bad.push(`entries of page ${pg} are not consecutive`);
                  refs.set(pg, (refs.get(pg) ?? 0) + 1);
                }
                table.depths.forEach((d, pg) => {
                  const span = 2 ** (g - d);
                  const at = first.get(pg) ?? -1;
                  if (d > g) bad.push(`page ${pg} deeper than the directory`);
                  if (refs.get(pg) !== span) bad.push(`page ${pg}: ${refs.get(pg)} entries, local depth ${d}`);
                  if (at % span !== 0) bad.push(`page ${pg} starts off its prefix boundary`);
                  if (table.buckets[pg].length > B) bad.push(`page ${pg} overfull`);
                  // its keys share its d leading bits
                  for (const k of table.buckets[pg]) if (lead(H1(k), d) !== at / span) bad.push(`key ${k} in page ${pg}`);
                });
                expect(bad, `${stream} b=${B} after operation ${r}`).toEqual([]);
              });
              expect(checked).toBeGreaterThan(0);
            }
          }
        });
      }
    });
  }
});

describe('hash kernels against the classical averages', () => {
  // seeded, so these are exact facts about one run, compared with the formulas as references
  for (const e of live) {
    const kernel = kernelOf(e.id);
    if (!kernel.expected || !kernel.maxLoad) continue;
    it(`${e.id}: measured probes on uniform keys lie near its formula at half load`, () => {
      const n = 2000;
      const { inserted, absent } = keys('uniform', n, 77);
      const steps: Step[] = [
        ...inserted.map((key) => ({ kind: KIND.insert, key }) as Step),
        ...inserted.map((key) => ({ kind: KIND.search, key }) as Step),
        ...absent.map((key) => ({ kind: KIND.search, key }) as Step),
      ];
      const t = trace(kernel, steps, { n, m: 2 * n, pageSize: 4 });
      const r = results(t);
      const a = n / t.table.m;
      const mean = (xs: Result[]) => xs.reduce((s, x) => s + x.probes, 0) / xs.length;
      const hits = r.slice(n, 2 * n);
      const misses = r.slice(2 * n);
      expect(hits.every((x) => x.ok)).toBe(true);
      expect(misses.every((x) => !x.ok)).toBe(true);
      expect(Math.abs(mean(hits) / kernel.expected!.hit(a) - 1)).toBeLessThan(0.1);
      expect(Math.abs(mean(misses) / kernel.expected!.miss(a) - 1)).toBeLessThan(0.15);
    });
  }

  for (const e of live) {
    const kernel = kernelOf(e.id);
    if (!kernel.growth) continue;
    it(`${e.id}: pages on uniform keys lie near n / (b ln 2)`, () => {
      const n = 4000;
      const { inserted } = keys('uniform', n, 5);
      for (const B of [4, 8]) {
        const t = trace(kernel, inserted.map((key) => ({ kind: KIND.insert, key }) as Step), { n, m: 1, pageSize: B });
        expect(Math.abs(t.table.m / kernel.growth!.pages(n, B) - 1)).toBeLessThan(0.15);
      }
    });
  }

  it('linear probing leaves no tombstone and double hashing leaves one per delete', () => {
    const steps = workload('uniform', 100, 50, 3);
    const lp = live.some((e) => e.id === 'linear-probing') ? trace(kernelOf('linear-probing'), steps, { n: 100, m: 125, pageSize: 4 }) : null;
    const dh = live.some((e) => e.id === 'double-hashing') ? trace(kernelOf('double-hashing'), steps, { n: 100, m: 125, pageSize: 4 }) : null;
    if (lp) expect(lp.table.tombstones).toBe(0);
    if (dh) expect(dh.table.tombstones).toBe(50);
  });

  it('the adversarial stream defeats h1 but not h2', () => {
    const { inserted } = keys('adversarial', 500, 13);
    const bands = new Set(inserted.map((k) => lead(H1(k), 6)));
    expect(bands.size).toBe(1);
    expect(new Set(inserted.map((k) => lead(H2(k), 6))).size).toBeGreaterThan(40);
  });
});

describe('hash engine bounds', () => {
  const modulesById = live.map((e) => ({ id: e.id, kernel: kernelOf(e.id) }));

  it('a truncated run keeps its table and counts exactly what its events replay to', () => {
    for (const { id, kernel } of modulesById) {
      const steps = workload('adversarial', 200, 50, 61);
      for (const cap of [1, 2, 3, 50, 333, 1001, 4099]) {
        const t = trace(kernel, steps, sizeFor(200, 0.9), cap);
        expect(t.truncated, `${id} cap ${cap}`).toBe(true);
        expect(t.length).toBe(cap);
        const again = replay(t, () => {});
        expect(again.buckets, `${id} cap ${cap}`).toEqual(t.table.buckets);
        expect(again.dir).toEqual(t.table.dir);
        expect(again.depths).toEqual(t.table.depths);
        expect(again.count).toBe(t.table.count);
        const tally = (op: number) => {
          let c = 0;
          for (let e = 0; e < t.length; e++) if (t.events[STRIDE * e] === op) c++;
          return c;
        };
        expect(t.counts.probes, `${id} cap ${cap}`).toBe(tally(OP.probe));
        expect(t.counts.hashes).toBe(tally(OP.hash));
        expect(t.counts.writes).toBe(tally(OP.write));
        expect(t.counts.removes).toBe(tally(OP.remove));
        expect(t.counts.loads).toBe(tally(OP.load));
        expect(t.counts.dirReads).toBe(tally(OP.dirRead));
        expect(t.counts.doublings).toBe(tally(OP.double));
      }
    }
  });

  it('draws an extendible table at the largest settings by its pages, not its directory', () => {
    for (const { id, kernel } of modulesById) {
      if (kernel.layout !== 'pages') continue;
      const code = engine.plate({ id, title: id, group: 'g' }, kernel);
      const range = (key: string) => code.params.find((d) => d.key === key) as { min: number; max: number };
      const n = range('n').max;
      const B = range('page').min;
      const t = trace(kernel, workload('adversarial', n, 0, 3), { n, m: 1, pageSize: B });
      expect(t.table.dir.length).toBeLessThanOrEqual(2 ** MAX_DEPTH);
      const r = new Replay(t, 'pages', n);
      r.advance(t.length);
      let reads = 0;
      const dir = r.table.dir;
      r.table.dir = new Proxy(dir, {
        get(target, key, recv) {
          if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
          return Reflect.get(target, key, recv);
        },
      });
      let calls = 0;
      const p = new Proxy({}, { get: (_t, k) => (typeof k === 'string' && k === k.toUpperCase() ? k : () => { calls++; }) });
      const ctx = { width: 1440, height: 810, fg: [0, 0, 0], bg: [255, 255, 255], palette: () => PALETTES[0] };
      drawTable(p as never, ctx as never, r, [0, 0, 1440, 810]);
      const pages = r.table.m;
      expect(pageRuns(r.table).length).toBeLessThanOrEqual(pages);
      // a few directory reads and a few drawing calls per page, whatever the directory's size
      expect(reads, `${id}: ${dir.length} directory entries, ${pages} pages`).toBeLessThanOrEqual(4 * pages + 4);
      expect(calls).toBeLessThanOrEqual(pages * (B + 8) + 16);
    }
  });

  it("spreads the lab's scaling runs over frames of bounded work and keeps every finished point", () => {
    const kernels = modulesById.map((k) => k.kernel);
    // the adversarial runs at the highest load the lab offers, the uniform ones at its default
    for (const [stream, load] of [['uniform', 0.75], ['adversarial', 0.95]] as const) {
      const s = new Scaling(kernels, stream, (n) => ({ n, m: Math.ceil(n / load), pageSize: 4 }), 5);
      let frames = 0;
      while (!s.done) {
        s.step();
        frames++;
        // a frame stops at the budget, overshooting by at most the operation in progress
        expect(s.lastEvents).toBeLessThanOrEqual(FRAME_EVENTS + 8 * SCALING_N[SCALING_N.length - 1]);
      }
      expect(frames).toBeGreaterThan(1);
      s.curves.forEach((pts, ci) => {
        expect(pts.map((q) => q[0]), `${modulesById[ci].id} ${stream}`).toEqual(SCALING_N);
        for (const [, w] of pts) expect(Number.isFinite(w) && w > 0).toBe(true);
        const slope = exponent(pts);
        if (stream === 'uniform') expect(slope, modulesById[ci].id).toBeLessThan(1.3);
        if (stream === 'adversarial' && modulesById[ci].id === 'linear-probing') expect(slope).toBeGreaterThan(1.6);
      });
    }
  });

  it('labels its controls as what they drive', () => {
    for (const { id, kernel } of modulesById) {
      const code = engine.plate({ id, title: id, group: 'g' }, kernel);
      expect(code.params.find((d) => d.key === 'speed')?.label).toBe('Trace events per frame');
    }
  });
});

describe('hash plates loop without a heavy frame', () => {
  const cpuMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
  const heaviest = (defs: ParamDef[]): Params => {
    const out: Params = {};
    for (const d of defs) out[d.key] = d.kind === 'range' ? d.max : d.value;
    return { ...out, stream: 'adversarial', loop: true };
  };
  const ctxOf = (params: Params, sink: { progress: string }): PlateContext => ({
    width: 400, height: 225, params, seed: 4242, rnd: mulberry32(4242), theme: 'dark',
    bg: [0, 0, 0], fg: [255, 255, 255], thumbnail: false, palette: () => PALETTES[0],
    stats(rows) { sink.progress = rows.find((r) => r.label === 'Progress')?.value ?? rows.map((r) => r.value).join('|'); },
    chart() {},
  });

  /** Drive a plate to the end of its run and through the handover; the worst frame's CPU time. */
  function drive(code: PlateCode, done: (s: string) => boolean): number {
    let best = Infinity;
    for (let rep = 0; rep < 1; rep++) {
      const sink = { progress: '' };
      const sim = code.create(p5Stub(), ctxOf(heaviest(code.params), sink));
      sim.setup();
      let worst = 0; let ended = false; let handed = false;
      for (let f = 0; f < 20000 && !handed; f++) {
        const t = cpuMs();
        sim.draw();
        worst = Math.max(worst, cpuMs() - t);
        if (done(sink.progress)) ended = true;
        else if (ended) handed = true;
      }
      expect(handed, `${code.id} handed over to its next run`).toBe(true);
      best = Math.min(best, worst);
    }
    return best;
  }

  for (const e of live) {
    // the frame's time is the budget gate's to judge (test/budget/, calibrated CPU time);
    // what is claimed here is that a run ends and hands over to the next one
    it(`${e.id}: a run ends and hands over to the next`, () => {
      const code = engine.plate({ id: e.id, title: e.id, group: 'g' }, kernelOf(e.id));
      drive(code, (s) => s.startsWith('100%'));
    });
  }

  it('the hashing lab hands over to its next run', () => {
    const code = engine.lab('hashing', live.map((e) => ({ info: { id: e.id, title: e.id, group: 'g' }, kernel: kernelOf(e.id) })));
    drive(code, (s) => s.split('|').every((v) => v.includes('finished')));
  });
  it('traces a next run in slices of bounded events', () => {
    const n = 512;
    const r = new Rebuild(live.map((e) => kernelOf(e.id)), workload('adversarial', n, 90, 1), { n, m: Math.ceil(n / 0.95), pageSize: 4 });
    const again = live.map((e) => trace(kernelOf(e.id), workload('adversarial', n, 90, 1), { n, m: Math.ceil(n / 0.95), pageSize: 4 }));
    // a slice stops at the budget, overshooting by at most the one operation it is inside
    // (a resize that reinserts every key is one operation)
    let largest = 0;
    for (const t of again) {
      let begin = 0;
      for (let e = 0; e < t.length; e++) {
        const op = t.events[STRIDE * e];
        if (op === OP.begin) begin = e;
        else if (op === OP.end) largest = Math.max(largest, e - begin + 1);
      }
    }
    let steps = 0;
    while (!r.ready) {
      r.step();
      steps++;
      expect(r.lastEvents).toBeLessThanOrEqual(FRAME_EVENTS + largest);
    }
    expect(steps).toBeGreaterThan(1);
    r.traces().forEach((t, i) => {
      expect(t.length).toBe(again[i].length);
      expect(t.table.buckets).toEqual(again[i].table.buckets);
    });
  });
});
