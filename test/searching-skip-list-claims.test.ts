// The skip-list plate as the claims read it: the stream stops after k operations
// (src/plates/_shared/settle, one run is one search, insertion or removal), and the links and
// comparisons in all are published. Then every claimed figure, recomputed by a skip list written
// here on a sorted array of (key, height) pairs, walking level by level as Pugh (1990) gives it.
//
// What is shared with the plate is its input, as workload() is for the trees: the operation
// stream drawn from the plate's seeded generator, and the coin flips that give each new node its
// height, drawn from the plate's second seeded generator (seed ^ 0x5bd1e995) one flip at a time
// until a flip fails or the top level is reached. The flips are input, not the kernel: a skip
// list is defined as a function of its coins. The walk, the links, the levels in use and every
// comparison are this file's own.
import type p5 from 'p5';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { claimSeeds, DEFAULT_SEED, type Claim } from '../src/core/claims';
import { PALETTES } from '../src/core/palette';
import type { Params, PlateCode, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import plate from '../src/plates/skip-list/plate';

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

describe('the skip-list plate stops and publishes its totals', () => {
  it('defaults are unchanged: no stop', () => {
    expect(plate.params.find((d) => d.key === 'runs')?.value).toBe(0);
  });

  it('stops after k operations and holds its readouts', () => {
    const a = run(plate, { runs: 120, pace: 4096 }, 3000);
    const b = run(plate, { runs: 120, pace: 4096 }, 4000);
    expect(value(a, 'completed runs')).toBe('120 of 120, stopped');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('publishes links and comparisons in all, after the readouts it had', () => {
    const rows = run(plate, { runs: 120, pace: 4096 }, 3000);
    const labels = rows.map((r) => r.label);
    const after = labels.indexOf('Comparisons of the last walk');
    for (const l of ['Links in all', 'Links per node', 'Comparisons in all']) expect(labels.indexOf(l), l).toBeGreaterThan(after);
    const perLevel = String(value(rows, 'Nodes per level, bottom up')).split(' · ').map(Number);
    expect(Number(value(rows, 'Links in all'))).toBe(perLevel.reduce((s, x) => s + x, 0));
  });
});

// ---- the oracle ----------------------------------------------------------------------------

interface Run { keys: number; links: number; comparisons: number; perNode: number }

/** The plate's operation stream replayed on a skip list written here. */
function replay(p: Record<string, unknown>, seed: number): Run {
  const target = Number(p.n);
  const prob = Number(p.p);
  const top = Math.min(16, Math.ceil(Math.log(target) / Math.log(1 / prob)) + 3);
  const rnd = mulberry32(seed);
  const coins = mulberry32(seed ^ 0x5bd1e995);
  const span = target * 4;
  // the list: keys ascending, each with its height (the levels it is linked on)
  const keys: number[] = [];
  const height: number[] = [];
  let comparisons = 0;
  const levels = () => Math.max(1, ...height);
  /** Pugh's walk from the head on the top level in use: on each level, look at the next node on
   * that level (one comparison) and move to it while its key is below the sought key. */
  const walk = (key: number) => {
    let at = -1; // the head
    for (let lv = levels() - 1; lv >= 0; lv--) {
      for (;;) {
        let nx = at + 1;
        while (nx < keys.length && height[nx] <= lv) nx++;
        if (nx >= keys.length) break;
        comparisons++;
        if (!(keys[nx] < key)) break;
        at = nx;
      }
    }
    return at + 1; // the position of the first key not below `key`
  };
  const ops = Number(p.runs);
  for (let k = 0; k < ops; k++) {
    let op: 'insert' | 'search' | 'remove';
    if (keys.length < target) op = 'insert';
    else op = rnd() < 0.7 ? 'search' : rnd() < 0.5 ? 'remove' : 'insert';
    const pick = op === 'remove' || (op === 'search' && rnd() < 0.6);
    const key = pick ? keys[Math.floor(rnd() * keys.length)] : Math.floor(rnd() * span);
    walk(key); // every operation looks the key up first
    if (op === 'insert') {
      const i = walk(key);
      if (keys[i] !== key) {
        let h = 1;
        while (h < top && coins() < prob) h++;
        keys.splice(i, 0, key);
        height.splice(i, 0, h);
      }
    } else if (op === 'remove') {
      const i = walk(key);
      if (keys[i] === key) { keys.splice(i, 1); height.splice(i, 1); }
    }
  }
  const links = height.reduce((s, h) => s + h, 0);
  return { keys: keys.length, links, comparisons, perNode: links / keys.length };
}

const defaults = Object.fromEntries(plate.params.map((d) => [d.key, d.value]));
const paramsOf = (c: Claim) => ({ ...defaults, ...(c.setup?.params ?? {}) }) as Record<string, unknown>;

/** The band a links-per-node claim must carry: 1 / (1 − p) ± 3 SD, the SD of the per-run mean
 * over the disjoint seeds 101–130 (fixed before they were run), widened by the 0.005 of display
 * rounding and rounded outward to two decimals. */
function band(p: Record<string, unknown>): [number, number] {
  const xs = Array.from({ length: 30 }, (_, i) => replay(p, 101 + i).perNode);
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1));
  const centre = 1 / (1 - Number(p.p));
  return [Math.floor((centre - 3 * sd - 0.005) * 100) / 100, Math.ceil((centre + 3 * sd + 0.005) * 100) / 100];
}

interface Entry { id: string; claims?: Claim[] }
const { model } = loadCatalogue(process.cwd()) as { model: { entries: Entry[] } };

describe('skip-list claims: every figure from a skip list written here', () => {
  it('at least three claims, each matching the replayed list', () => {
    const claims = model.entries.find((e) => e.id === 'skip-list')?.claims ?? [];
    expect(claims.length).toBeGreaterThanOrEqual(3);
    for (const c of claims) {
      const p = paramsOf(c);
      expect(Number(p.runs), `${c.id}: the claim stops the stream`).toBeGreaterThan(0);
      if (c.readout === 'Links per node') {
        expect(c.expect.range, `${c.id}: the band from the disjoint seeds`).toEqual(band(p));
        for (const seed of claimSeeds(c)) expect(seed, `${c.id}: a claimed seed is not a band seed`).toBeLessThan(101);
        continue;
      }
      const r = replay(p, c.setup?.seed ?? DEFAULT_SEED);
      const got = c.readout === 'Links in all' ? r.links : c.readout === 'Keys' ? r.keys
        : c.readout === 'Comparisons in all' ? r.comparisons : NaN;
      expect(c.expect.value, `${c.id} (${c.readout})`).toBe(got);
    }
  });
});
