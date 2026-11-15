// The indexed-sequential-access plate as the claims read it: the stream stops after k operations
// (src/plates/_shared/settle, one run is one search or insertion), and the searches, index
// comparisons and page reads in all are published. Then every claimed figure, recomputed by a
// static ISAM file written here: primary pages loaded to the fill factor, an index of each page's
// first key searched by a binary search of its own, and overflow pages chained behind a full
// primary page. What is shared with the plate is its input only: the keys at load time and the
// operation stream, drawn from the plate's seeded generator in the plate's order.
import type p5 from 'p5';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { DEFAULT_SEED, type Claim } from '../src/core/claims';
import { PALETTES } from '../src/core/palette';
import type { Params, PlateCode, PlateContext, Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { sortedKeys } from '../src/plates/_shared/sorted-search/search';
import plate from '../src/plates/indexed-sequential-access/plate';

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

describe('the indexed-sequential-access plate stops and publishes its totals', () => {
  it('defaults are unchanged: no stop', () => {
    expect(plate.params.find((d) => d.key === 'runs')?.value).toBe(0);
  });

  it('stops after k operations and holds its readouts', () => {
    const a = run(plate, { runs: 200, pace: 4096 }, 3000);
    const b = run(plate, { runs: 200, pace: 4096 }, 4000);
    expect(value(a, 'completed runs')).toBe('200 of 200, stopped');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('publishes searches, index comparisons and page reads in all, after the readouts it had', () => {
    const rows = run(plate, { runs: 200, pace: 4096, inserts: 0 }, 3000);
    const labels = rows.map((r) => r.label);
    const after = labels.findIndex((l) => l.startsWith('Page reads per search, last'));
    for (const l of ['Searches', 'Index comparisons in all', 'Page reads in all']) expect(labels.indexOf(l), l).toBeGreaterThan(after);
    expect(value(rows, 'Searches')).toBe('200');
  });
});

// ---- the oracle ----------------------------------------------------------------------------

interface File { searches: number; comparisons: number; reads: number; primary: number; overflow: number; longest: number }

/** The plate's operation stream replayed on an ISAM file written here. */
function replay(p: Record<string, unknown>, seed: number): File {
  const rnd = mulberry32(seed);
  const n = Number(p.n);
  const size = Number(p.page);
  const loadedKeys = sortedKeys(n, 'uniform', rnd);
  const top = loadedKeys[n - 1] + 1;
  const per = Math.max(1, Math.min(size, Math.round(size * Number(p.fill))));
  const primary: number[][] = [];
  for (let i = 0; i < n; i += per) primary.push(loadedKeys.slice(i, i + per));
  const firsts = primary.map((pg) => pg[0]);
  const chains: number[][][] = primary.map(() => []);
  const stored = loadedKeys.slice();
  let count = n;
  let searches = 0;
  let comparisons = 0;
  let reads = 0;
  /** The last page whose first key is ≤ key (page 0 below every first key), by a binary search
   * over the index that runs to the end, one comparison per entry looked at. */
  const page = (key: number) => {
    let lo = 0;
    let hi = firsts.length - 1;
    let at = 0;
    let cmp = 0;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      cmp++;
      if (firsts[mid] <= key) { at = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return { at, cmp };
  };
  /** Pages read to find key: the primary page, then each overflow page until the key. */
  const look = (key: number) => {
    const { at, cmp } = page(key);
    if (primary[at].includes(key)) return { found: true, at, cmp, reads: 1 };
    let r = 1;
    for (const o of chains[at]) { r++; if (o.includes(key)) return { found: true, at, cmp, reads: r }; }
    return { found: false, at, cmp, reads: r };
  };
  for (let k = 0; k < Number(p.runs); k++) {
    if (rnd() < Number(p.inserts) && count < n * 3) {
      const key = p.hot ? Math.floor(top * (0.4 + Number(p.band) * rnd())) : Math.floor(rnd() * top);
      const l = look(key);
      if (l.found) continue;
      const pg = primary[l.at];
      if (pg.length < size) { pg.push(key); pg.sort((a, b) => a - b); } else {
        const ch = chains[l.at];
        if (!ch.length || ch[ch.length - 1].length >= size) ch.push([]);
        ch[ch.length - 1].push(key);
      }
      count++;
      stored.push(key);
      continue;
    }
    const key = rnd() < 0.8 ? stored[Math.floor(rnd() * stored.length)] : Math.floor(rnd() * top);
    const l = look(key);
    searches++;
    comparisons += l.cmp;
    reads += l.reads;
  }
  return {
    searches, comparisons, reads, primary: primary.length,
    overflow: chains.reduce((s, c) => s + c.length, 0), longest: Math.max(0, ...chains.map((c) => c.length)),
  };
}

const defaults = Object.fromEntries(plate.params.map((d) => [d.key, d.value]));
const READING: Record<string, keyof File> = {
  Searches: 'searches', 'Index comparisons in all': 'comparisons', 'Page reads in all': 'reads',
  'Primary pages': 'primary', 'Overflow pages': 'overflow', 'Longest overflow chain': 'longest',
};

interface Entry { id: string; claims?: Claim[] }
const { model } = loadCatalogue(process.cwd()) as { model: { entries: Entry[] } };

describe('indexed-sequential-access claims: every figure from an ISAM file written here', () => {
  it('at least three claims, each matching the replayed file', () => {
    const claims = model.entries.find((e) => e.id === 'indexed-sequential-access')?.claims ?? [];
    expect(claims.length).toBeGreaterThanOrEqual(3);
    for (const c of claims) {
      const p = { ...defaults, ...(c.setup?.params ?? {}) } as Record<string, unknown>;
      expect(Number(p.runs), `${c.id}: the claim stops the stream`).toBeGreaterThan(0);
      const r = replay(p, c.setup?.seed ?? DEFAULT_SEED);
      expect(READING[c.readout], `${c.id}: an oracle reading for "${c.readout}"`).toBeDefined();
      expect(c.expect.value, `${c.id} (${c.readout})`).toBe(r[READING[c.readout]]);
    }
  });

  it('the load fills ⌈n / round(page · fill)⌉ primary pages', () => {
    for (const [n, page, fill] of [[160, 8, 0.75], [32, 4, 0.5], [480, 16, 1]]) {
      const r = replay({ ...defaults, n, page, fill, runs: 1 }, 1);
      expect(r.primary).toBe(Math.ceil(n / Math.round(page * fill)));
    }
  });

  it('with no insertions no page overflows, and every search reads one page', () => {
    const r = replay({ ...defaults, inserts: 0, runs: 300 }, 7);
    expect(r.overflow).toBe(0);
    expect(r.reads).toBe(r.searches);
  });
});
