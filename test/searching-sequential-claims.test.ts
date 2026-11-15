// The sequential-search plate as the claims read it: the stream stops after k searches
// (src/plates/_shared/settle, one run is one search) and the probes in all are published. Then
// every claimed figure, recomputed by a list search written here (static, move-to-front,
// transpose) over the plate's own seeded input: the shuffled list and the query stream, which
// draws a Zipf rank for a hit and a never-stored key for a miss (the plate's input, shared as
// workload() is for the trees; the list and its reorganisation are not).
import type p5 from 'p5';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { DEFAULT_SEED, type Claim } from '../src/core/claims';
import { PALETTES } from '../src/core/palette';
import type { Params, PlateCode, PlateContext, Stat } from '../src/core/plate';
import { mulberry32, shuffle } from '../src/core/random';
import plate from '../src/plates/sequential-search/plate';
import { draw as drawRank, zipf } from '../src/plates/sequential-search/sequential';

const stub = new Proxy({}, { get: () => () => undefined }) as unknown as p5;

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

describe('the sequential-search plate stops and publishes its probes in all', () => {
  it('defaults are unchanged: no stop', () => {
    expect(plate.params.find((d) => d.key === 'runs')?.value).toBe(0);
  });

  it('stops after k searches and holds its readouts', () => {
    const a = run(plate, { runs: 30, pace: 4096 }, 3000);
    const b = run(plate, { runs: 30, pace: 4096 }, 4000);
    expect(value(a, 'Searches')).toBe('30');
    expect(value(a, 'completed runs')).toBe('30 of 30, stopped');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('publishes the probes in all, after the readouts it had', () => {
    const rows = run(plate, { runs: 30, pace: 4096 }, 3000);
    const labels = rows.map((r) => r.label);
    expect(labels.indexOf('Probes in all')).toBeGreaterThan(labels.indexOf('Probes of the search shown'));
    expect(Number(value(rows, 'Probes in all'))).toBeGreaterThanOrEqual(30);
  });
});

// ---- the claims ---------------------------------------------------------------------------

interface Entry { id: string; claims?: Claim[] }
const { model } = loadCatalogue(process.cwd()) as { model: { entries: Entry[] } };

/** A scan of an array from the front, one probe per key looked at, then the strategy's
 * reorganisation after a hit: nothing, move the key to the front, or swap it with the key
 * before it. A miss looks at every key. */
function scan(list: number[], key: number, strategy: string): number {
  const i = list.indexOf(key);
  if (i < 0) return list.length;
  if (strategy === 'move-to-front' && i > 0) { list.splice(i, 1); list.unshift(key); }
  if (strategy === 'transpose' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
  return i + 1;
}

/** The probes of a claim's searches, replayed from its seed: the list is shuffled first, then
 * each search draws hit or miss, then its key. */
function replay(c: Claim): number[] {
  const p = { ...Object.fromEntries(plate.params.map((d) => [d.key, d.value])), ...(c.setup?.params ?? {}) } as Record<string, unknown>;
  const rnd = mulberry32(c.setup?.seed ?? DEFAULT_SEED);
  const n = Number(p.n);
  const cdf = zipf(n, Number(p.skew));
  const list = shuffle(Array.from({ length: n }, (_, k) => k), rnd);
  const out: number[] = [];
  for (let s = 0; s < Number(p.runs); s++) {
    const hit = rnd() < Number(p.hit);
    const key = hit ? drawRank(cdf, rnd) : n + Math.floor(rnd() * n);
    out.push(scan(list, key, String(p.strategy)));
  }
  return out;
}

describe('sequential-search claims: every figure from a list search written here', () => {
  it('at least three claims, each matching the replayed searches', () => {
    const claims = model.entries.find((e) => e.id === 'sequential-search')?.claims ?? [];
    expect(claims.length).toBeGreaterThanOrEqual(3);
    for (const c of claims) {
      const probes = replay(c);
      expect(probes.length, `${c.id}: the claim stops the stream`).toBeGreaterThan(0);
      expect(c.readout, c.id).toBe('Probes in all');
      expect(c.expect.value, c.id).toBe(probes.reduce((s, x) => s + x, 0));
    }
  });

  it('a miss scans the whole list: k misses on n keys cost exactly k n', () => {
    const c = { id: 'misses', statement: '', readout: 'Probes in all', expect: { value: 0 },
      setup: { params: { n: 96, hit: 0, runs: 50, strategy: 'static' } } } as Claim;
    expect(replay(c).every((x) => x === 96)).toBe(true);
  });
});
