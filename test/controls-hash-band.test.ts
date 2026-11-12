// The adversarial key stream's shared hash bits become a control (S2 C4): every hash plate gets
// it from one factory, so they stay in step. The adversarial stream built keys whose h1 values
// share their leading 6 bits; now their leading b bits for the control b, whose default 6 is the
// old constant. It shows only with the adversarial stream and never reaches the hashing lab.
// Checked: the control exists on each plate, it travels in a shared link, every adversarial key
// shares its b bits and the tables crowd as the pigeonhole principle says, it drives what the
// plates read, and every hash run at the defaults is what it was before the control existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine, longestChain, longestCluster } from '../src/engines/hash/index';
import { h1, slotOf, trace, type HashKernel } from '../src/engines/hash/table';
import { keys, STREAMS, workload } from '../src/engines/hash/workload';
import { loadLab } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const modules = import.meta.glob<HashKernel>('../src/kernels/hash/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => modules[`../src/kernels/hash/${id}.ts`];
const plateOf = (id: string) => {
  const e = ENTRIES.find((x) => x.id === id)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const PLATES = ['separate-chaining', 'linear-probing', 'double-hashing', 'extendible-hashing', 'dynamic-hash-table'];
const KEY = 'band';
/** Controls the hash plates gained in S2, each with its own test of its defaults. */
const ADDED = ['band', 'grow', 'shrink'];
/** The plates' default keys inserted and load factor (src/engines/hash/index.ts params()). */
const N = 96;
const LOAD = 0.75;
const SEED = 4242;

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);

/** Buckets a band of b shared leading bits can reach in a table of m: the band is 2^(32 − b)
 * hash values wide, so its slots span at most ⌈m / 2^b⌉ + 1 (one more where its ends cut two). */
const reach = (m: number, b: number) => Math.ceil(m / 2 ** b) + 1;
/** Pigeonhole: n keys over at most c chains put at least ⌈n / c⌉ keys in one of them. */
const chainBound = (n: number, m: number, b: number) => Math.ceil(n / reach(m, b));
/** Linear probing: every cluster holding a key holds that key's home, inside the c slots the band
 * reaches, and two clusters are parted by an empty slot, so at most ⌈c / 2⌉ clusters hold the n
 * keys and one of them holds at least ⌈n / ⌈c / 2⌉⌉. */
const clusterBound = (n: number, m: number, b: number) => Math.ceil(n / Math.ceil(reach(m, b) / 2));

/** Extendible hashing at global depth g: the keys' shared b bits leave them 2^(g − b) directory
 * entries, so at most that many pages of B keys hold all n of them: 2^(g − b) ≥ ⌈n / B⌉, and
 * g ≥ b + ⌈lg ⌈n / B⌉⌉ (at least b + 1 once n > B). */
const depthBound = (n: number, B: number, b: number) => b + Math.ceil(Math.log2(Math.ceil(n / B)));

const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, number> } });

describe('hash plates: adversarial shared bits', () => {
  it('is one range control on every hash plate, the old six bits its default, shown with its stream', async () => {
    for (const id of PLATES) {
      const d = plateOf(id).params.find((x) => x.key === KEY);
      expect(d, id).toMatchObject({ kind: 'range', label: 'Adversarial shared bits', min: 1, max: 6, step: 1, value: 6,
        rebuild: true, when: { key: 'stream', values: ['adversarial'] } });
      expect(d, `${id} gets it as the others do`).toEqual(plateOf(PLATES[0]).params.find((x) => x.key === KEY));
    }
    const lab = await loadLab('hashing');
    expect(lab!.params.some((d) => d.key === KEY), 'the lab keeps the default band').toBe(false);
  });

  it('round-trips through a shared link', () => {
    for (const id of PLATES) {
      const defs = plateOf(id).params;
      const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
      for (const b of [1, 3, 5]) {
        expect(parse(defs, serialise(defs, { ...d, stream: 'adversarial', [KEY]: b }, 7)), `${id} ${b}`)
          .toEqual({ seed: 7, params: { stream: 'adversarial', [KEY]: b } });
      }
    }
  });

  it('gives every adversarial key the same b leading hash bits, and the tables crowd as counted', () => {
    const d = plateOf('separate-chaining').params.find((x) => x.key === KEY) as RangeParam | undefined;
    expect(d, 'the plate offers the control').toBeDefined();
    for (const b of settings(d!)) {
      for (const n of [8, N, 512]) {
        for (const seed of [1, 42, SEED]) {
          const { inserted, absent } = keys('adversarial', n, seed, b);
          const top = new Set([...inserted, ...absent].map((k) => h1(k) >>> (32 - b)));
          expect(top.size, `b=${b} n=${n} seed=${seed}: one band`).toBe(1);
          expect(new Set([...inserted, ...absent]).size).toBe(2 * n);
          const steps = workload('adversarial', n, 0, seed, b);
          const m = Math.ceil(n / LOAD);
          const homes = new Set(inserted.map((k) => slotOf(h1(k), m)));
          expect(homes.size, `b=${b}: homes in reach`).toBeLessThanOrEqual(reach(m, b));
          const chained = trace(kernelOf('separate-chaining'), steps, { n, m, pageSize: 4 });
          expect(longestChain(chained.table), `chaining b=${b} n=${n}`).toBeGreaterThanOrEqual(chainBound(n, m, b));
          const probed = trace(kernelOf('linear-probing'), steps, { n, m, pageSize: 4 });
          expect(longestCluster(probed.table), `probing b=${b} n=${n}`).toBeGreaterThanOrEqual(clusterBound(n, m, b));
          for (const B of [4, 16]) {
            const ext = trace(kernelOf('extendible-hashing'), steps, { n, m: 1, pageSize: B });
            if (n > B && !ext.truncated) expect(ext.table.globalDepth, `extendible b=${b} n=${n} B=${B}`).toBeGreaterThanOrEqual(depthBound(n, B, b));
          }
        }
      }
    }
  }, 120_000);

  it('drives the plates\' readouts', async () => {
    const m = Math.ceil(N / LOAD);
    for (const b of [1, 3, 6]) {
      const at = { stream: 'adversarial', deletes: 0, [KEY]: b };
      const chain = await read('separate-chaining', claim('Longest chain', at));
      expect(chain.reason).toBeUndefined();
      expect(chain.value!, `b=${b}`).toBeGreaterThanOrEqual(chainBound(N, m, b));
      const cluster = await read('linear-probing', claim('Longest cluster', at));
      expect(cluster.value!, `b=${b}`).toBeGreaterThanOrEqual(clusterBound(N, m, b));
      const depth = await read('extendible-hashing', claim('Global depth', at));
      expect(depth.value!, `b=${b}`).toBeGreaterThanOrEqual(depthBound(N, 4, b));
    }
    const wide = await read('separate-chaining', claim('Longest chain', { stream: 'adversarial', deletes: 0, [KEY]: 1 }));
    const narrow = await read('separate-chaining', claim('Longest chain', { stream: 'adversarial', deletes: 0, [KEY]: 6 }));
    expect(narrow.value!, 'a narrower band, longer chains').toBeGreaterThan(wide.value!);
  }, 120_000);
});

describe('the hash engine at the defaults is what it was before the band control', () => {
  // recorded on the code before the control existed (S5 779097a)
  const TRACES = 'd5b9640cf619f592';
  const PARAMS = 'a014c2c5d3f65ab6';
  const LAB = '19e82f09067f9590';

  const runs = (bits?: number) => Object.keys(modules).sort().map((path) => {
    const k = modules[path];
    const rows: unknown[] = [];
    for (const stream of STREAMS) for (const n of [8, 96, 256]) for (const seed of [1, SEED]) for (const del of [0, 50]) {
      for (const ld of k.maxLoad ? [25, 75, k.maxLoad] : [100]) for (const page of k.layout === 'pages' ? [4, 9] : [4]) {
        const steps = bits === undefined ? workload(stream, n, del, seed) : workload(stream, n, del, seed, bits);
        const t = trace(k, steps, { n, m: Math.max(1, Math.ceil(n / (ld / 100))), pageSize: page });
        rows.push([path.replace('../src', '/src'), stream, n, seed, del, ld, page, hash(steps),
          hash(Array.from(t.events.subarray(0, 5 * t.length))), t.counts, t.truncated]);
      }
    }
    return rows;
  });

  it('every hash kernel draws the same keys and records the same trace, the default given or not', () => {
    const bare = runs();
    expect(hash(bare), 'as recorded before the control').toBe(TRACES);
    expect(hash(runs(6)), 'the default given').toBe(hash(bare));
  }, 120_000);

  it('every hash plate and the hashing lab offer the same controls, the new ones aside', async () => {
    const defs = PLATES.map((id) => [id, plateOf(id).params.filter((d) => !ADDED.includes(d.key))]);
    expect(hash(defs)).toBe(PARAMS);
    const lab = await loadLab('hashing');
    expect(hash(lab!.params)).toBe(LAB);
  });

  it('the hash plates read the same at their defaults, the default given or not', async () => {
    for (const id of PLATES) {
      for (const stream of ['uniform', 'adversarial']) {
        for (const readout of ['Keys stored', 'Longest chain', 'Longest cluster', 'Global depth', 'Probes per search',
          'Keys compared per search', 'Hash evaluations', 'Writes', 'Progress']) {
          const bare = await read(id, claim(readout, { stream }));
          const given = await read(id, claim(readout, { stream, [KEY]: 6 }));
          expect(given.text, `${id} ${stream} ${readout}`).toBe(bare.text);
        }
      }
    }
  }, 120_000);
});
