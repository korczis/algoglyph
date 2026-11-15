// The sorted-array search plates (binary-search, interpolation-search) as the claims read them:
// the stream stops after k searches (src/plates/_shared/settle, one run is one search), the
// integer totals are published, and the evenly spaced spread exists beside the default one. Then
// every claimed figure, recomputed by searches written here over the same seeded keys and query
// stream the plate draws (sortedKeys and query are the plate's input, shared as workload() is
// for the trees; the searches are not).
import type p5 from 'p5';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { DEFAULT_SEED, type Claim } from '../src/core/claims';
import { PALETTES } from '../src/core/palette';
import type { Params, PlateCode, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { query, sortedKeys, type Spread } from '../src/plates/_shared/sorted-search/search';
import binaryPlate from '../src/plates/binary-search/plate';
import interpolationPlate from '../src/plates/interpolation-search/plate';

const stub = new Proxy({}, { get: () => () => undefined }) as unknown as p5;

/** Run a plate headless for `frames` frames at `over` on its defaults; the last readouts. */
function run(code: PlateCode, over: Params, frames: number, seed = DEFAULT_SEED): Stat[] {
  const params: Params = {};
  for (const d of code.params) params[d.key] = d.value;
  Object.assign(params, over);
  let rows: Stat[] = [];
  const ctx: PlateContext = {
    width: 800, height: 500, params, seed, rnd: mulberry32(seed), theme: 'dark',
    bg: [0, 0, 0], fg: [255, 255, 255], palette: () => PALETTES[0], thumbnail: false,
    stats: (r) => { rows = r; }, chart: () => {},
  };
  const sim = code.create(stub, ctx);
  sim.setup();
  for (let f = 0; f < frames; f++) sim.draw();
  return rows;
}
const value = (rows: Stat[], label: string) => rows.find((r) => r.label === label)?.value;

describe('the sorted-array search plates stop, publish totals and offer evenly spaced keys', () => {
  for (const code of [binaryPlate, interpolationPlate]) {
    it(`${code.id}: the defaults are unchanged: random uniform keys, no stop`, () => {
      expect(code.params.find((d) => d.key === 'spread')?.value).toBe('uniform');
      expect(code.params.find((d) => d.key === 'runs')?.value).toBe(0);
      const spread = code.params.find((d) => d.key === 'spread');
      expect(spread?.kind === 'select' && spread.options.map((o) => o.value)).toEqual(['uniform', 'logarithmic', 'even']);
    });

    it(`${code.id}: stops after k searches and holds its readouts`, () => {
      const a = run(code, { runs: 40, pace: 1000 }, 3000);
      const b = run(code, { runs: 40, pace: 1000 }, 4000);
      expect(value(a, 'Searches')).toBe('40');
      expect(value(a, 'completed runs')).toBe('40 of 40, stopped');
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it(`${code.id}: publishes the probes in all, after the readouts it had`, () => {
      const rows = run(code, { runs: 40, pace: 1000 }, 3000);
      const labels = rows.map((r) => r.label);
      expect(labels.indexOf('Probes in all')).toBeGreaterThan(labels.indexOf('Most probes in one search'));
      expect(Number(value(rows, 'Probes in all'))).toBeGreaterThanOrEqual(40);
    });
  }

  it('evenly spaced keys are a[i] = 8i, drawn without the random stream', () => {
    const rnd = mulberry32(1);
    expect(sortedKeys(6, 'even', rnd)).toEqual([0, 8, 16, 24, 32, 40]);
    expect(rnd()).toBe(mulberry32(1)());
  });
});

// ---- the claims ---------------------------------------------------------------------------

interface Entry { id: string; claims?: Claim[] }
const { model } = loadCatalogue(process.cwd()) as { model: { entries: Entry[] } };

/** Binary search as Knuth gives it, counting probes: the middle of [lo, hi], ⌊(lo + hi) / 2⌋. */
function binaryProbes(a: number[], key: number): number {
  let lo = 0;
  let hi = a.length - 1;
  let probes = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    probes++;
    if (a[mid] === key) return probes;
    if (key < a[mid]) hi = mid - 1; else lo = mid + 1;
  }
  return probes;
}

/** Interpolation search with exact integer arithmetic (BigInt), counting probes: the guess is
 * lo + ⌊(key − a[lo]) (hi − lo) / (a[hi] − a[lo])⌋ while the key lies within [a[lo], a[hi]]. */
function interpolationProbes(a: number[], key: number): number {
  let lo = 0;
  let hi = a.length - 1;
  let probes = 0;
  while (lo <= hi && key >= a[lo] && key <= a[hi]) {
    const span = BigInt(a[hi] - a[lo]);
    const mid = span === 0n ? lo : lo + Number((BigInt(key - a[lo]) * BigInt(hi - lo)) / span);
    probes++;
    if (a[mid] === key) return probes;
    if (a[mid] < key) lo = mid + 1; else hi = mid - 1;
  }
  return probes;
}

/** The searches a claim's setup makes, replayed: the plate's keys, then its query stream, from
 * the claim's seed (the setup draws the keys first, each search draws its query when it starts). */
function replay(c: Claim, defaults: Params, probe: (a: number[], k: number) => number) {
  const p = { ...defaults, ...(c.setup?.params ?? {}) } as Record<string, unknown>;
  const rnd = mulberry32(c.setup?.seed ?? DEFAULT_SEED);
  const keys = sortedKeys(Number(p.n), String(p.spread) as Spread, rnd);
  const present = new Set(keys);
  const counts: number[] = [];
  for (let s = 0; s < Number(p.runs); s++) counts.push(probe(keys, query(keys, Number(p.hit), rnd, present)));
  return { keys, counts, p };
}

const defaultsOf = (code: PlateCode): Params => Object.fromEntries(code.params.map((d) => [d.key, d.value]));

describe('sorted-array search claims: every figure from searches written here', () => {
  for (const [code, probe] of [[binaryPlate, binaryProbes], [interpolationPlate, interpolationProbes]] as const) {
    it(`${code.id}: at least three claims, each matching the replayed searches`, () => {
      const claims = model.entries.find((e) => e.id === code.id)?.claims ?? [];
      expect(claims.length).toBeGreaterThanOrEqual(3);
      for (const c of claims) {
        const { counts, p } = replay(c, defaultsOf(code), probe);
        expect(Number(p.runs), `${c.id}: the claim stops the stream`).toBeGreaterThan(0);
        const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
        const got = c.readout === 'Probes in all' ? sum(counts)
          : c.readout === 'Most probes in one search' ? Math.max(...counts)
            : c.readout === 'Probes in all, binary search on the same keys' ? sum(replay(c, defaultsOf(code), binaryProbes).counts)
              : NaN;
        expect(c.expect.value, `${c.id} (${c.readout})`).toBe(got);
      }
    });
  }

  /** On n = 2^k keys an interval [lo, hi] of size m splits at ⌊(lo + hi) / 2⌋ into a left part of
   * ⌈m / 2⌉ − 1 keys and a right part of ⌊m / 2⌋: the left is never the larger. From 2^k a miss
   * that goes left reaches 2^(k−1) − 1 and needs k − 1 more probes, one that goes right reaches
   * 2^(k−1). Only the path that goes right every time reaches an interval of one key, the last,
   * at its (k + 1)-th probe: a miss needs k + 1 probes exactly when it is above a[n − 2]. */
  it('binary search on 2^k keys: every miss costs k probes, k + 1 only above the second-largest key', () => {
    for (const k of [3, 7, 10]) {
      const n = 2 ** k;
      for (const seed of [1, 2, 3]) {
        const keys = sortedKeys(n, 'uniform', mulberry32(seed));
        for (let q = -1; q <= keys[n - 1] + 3; q++) {
          if (keys.includes(q)) continue;
          expect(binaryProbes(keys, q), `n ${n}, miss ${q}`).toBe(q > keys[n - 2] ? k + 1 : k);
        }
      }
    }
  });

  /** On a[i] = 8i the guess for a present key a[i] = 8i from any [lo, hi] holding it is
   * lo + ⌊(8i − 8lo)(hi − lo) / (8hi − 8lo)⌋ = lo + ⌊(i − lo)⌋ = i: the numerator is a multiple
   * of the span, so the division is exact and the first probe lands on the key. */
  it('interpolation search finds every present key of a[i] = 8i with exactly one probe', () => {
    for (const n of [8, 128, 1024]) {
      const keys = sortedKeys(n, 'even', mulberry32(0));
      for (const k of keys) expect(interpolationProbes(keys, k), `n ${n}, key ${k}`).toBe(1);
    }
  });
});
