// rule-weaver (wave 6). Defect D6: the generation readout was one ahead of the row it labels:
// setup painted the first row (generation 0) and then set the counter to 1, so after k steps the
// row shown was generation k and the label read k + 1. Each check here reads the plate through
// the claims instrument (test/support/claims.ts) and compares it with an elementary automaton
// written out below, independent of the plate's own rule.ts. Then a readout of the first row's
// live cells, so that a rule that conserves its live cells (184, the traffic rule) can be read
// against it. Last, the oracles of the entry's claims, each computed here and compared with the
// value the claim states: Lucas's theorem for rule 90's counts, exhaustion for 184's conservation.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { DEFAULT_SEED } from '../src/core/claims';
import type { Params } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { RUNS_KEY } from '../src/plates/_shared/settle/settle';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

/** A claim that reads `readout` once the run has settled, judging nothing. */
const probe = (readout: string, params: Params): Claim => ({
  id: 'probe', statement: `the ${readout} readout once settled`, readout,
  expect: { range: [-Number.MAX_VALUE, Number.MAX_VALUE] }, setup: { params },
});

/** The text of `readout` once the run has settled, failing on any reason. */
async function settled(readout: string, params: Params): Promise<string> {
  const r = await read('rule-weaver', probe(readout, params));
  expect(r.reason, JSON.stringify(params)).toBeUndefined();
  return r.text as string;
}

/** The row after one generation of elementary rule `rule` on a ring. */
function stepRow(rule: number, row: Uint8Array): Uint8Array {
  const width = row.length;
  const next = new Uint8Array(width);
  for (let i = 0; i < width; i++) {
    const l = row[(i + width - 1) % width];
    const r = row[(i + 1) % width];
    next[i] = (rule >> ((l << 2) | (row[i] << 1) | r)) & 1;
  }
  return next;
}

/** Elementary rule `rule` on a ring of `width` cells from one live cell, `n` generations on. */
function weave(rule: number, width: number, n: number): Uint8Array {
  let row: Uint8Array = new Uint8Array(width);
  row[Math.floor(width / 2)] = 1;
  for (let g = 0; g < n; g++) {
    row = stepRow(rule, row);
  }
  return row;
}

/** The plate's 'random' first row: one draw per cell, alive below 0.5, from the run's seed. */
function randomRow(width: number, seed = DEFAULT_SEED): Uint8Array {
  const rnd = mulberry32(seed);
  return Uint8Array.from({ length: width }, () => (rnd() < 0.5 ? 1 : 0));
}

const count = (row: Uint8Array) => row.reduce((a, b) => a + b, 0);
/** The plate's share format: the percentage of the ring alive, to one decimal. */
const share = (n: number, width: number) => `${((100 * n) / width).toFixed(1)} %`;

// at the claims instrument's 800 px and the default 4 px cells the ring has 200 cells
const WIDTH = 200;

describe('rule-weaver D6: the generation label is the row shown', () => {
  it('reads generation k, not k + 1, when the stop holds the k-th row', async () => {
    // rule 30 from one cell: its live count differs at k and k + 1 here, so the row read is k's
    for (const k of [2, 7, 63]) {
      const row = weave(30, WIDTH, k);
      expect(count(row)).not.toBe(count(weave(30, WIDTH, k + 1)));
      const p = { rule: 30, [RUNS_KEY]: k };
      expect(await settled('live cells', p), `live cells at ${k}`).toBe(share(count(row), WIDTH));
      expect(await settled('generation', p), `generation at ${k}`).toBe(k.toLocaleString('en'));
    }
  });
});

describe('rule-weaver: the live cells of the first row', () => {
  const FIRST = 'live cells in the first row';

  it('reads the first row, whatever the rule has made of it since', async () => {
    const first = share(count(randomRow(WIDTH)), WIDTH);
    for (const [rule, k] of [[30, 51], [110, 7], [184, 120]]) {
      const p = { rule, start: 'random', [RUNS_KEY]: k };
      expect(await settled(FIRST, p), `rule ${rule} at ${k}`).toBe(first);
    }
    // under rule 30 the live share has moved off it (98 of the 200 cells at generation 51,
    // against 100 at the start, by this seed): the readout is not the current row's
    const now = share(count(Array.from({ length: 51 }).reduce<Uint8Array>(
      (r) => stepRow(30, r), randomRow(WIDTH))), WIDTH);
    expect(now).not.toBe(first);
    expect(await settled('live cells', { rule: 30, start: 'random', [RUNS_KEY]: 51 })).toBe(now);
  });

  it('is the single cell of the single start', async () => {
    expect(await settled(FIRST, { rule: 90, [RUNS_KEY]: 5 })).toBe(share(1, WIDTH));
  });

  it('rule 184 conserves its live cells on every ring up to 12 cells; rule 30 does not', () => {
    // the oracle of the conservation claim, by exhaustion: every configuration of every ring
    const conserves = (rule: number) => {
      for (let width = 3; width <= 12; width++) {
        for (let bits = 0; bits < 1 << width; bits++) {
          const row = Uint8Array.from({ length: width }, (_, i) => (bits >> i) & 1);
          if (count(stepRow(rule, row)) !== count(row)) return false;
        }
      }
      return true;
    };
    expect(conserves(184)).toBe(true);
    expect(conserves(30)).toBe(false);
  });

  it('reads the same as the live cells under rule 184 from a random row', async () => {
    for (const k of [1, 99, 300]) {
      const p = { rule: 184, start: 'random', [RUNS_KEY]: k };
      expect(await settled('live cells', p), `at ${k}`).toBe(await settled(FIRST, p));
    }
  });
});

/** The entry's claims as the catalogue loads them. */
function claimsOf(id: string): Claim[] {
  type Model = { model: { entries: { id: string; claims: Claim[] }[] } };
  const { model } = loadCatalogue(process.cwd()) as Model;
  return model.entries.find((e) => e.id === id)?.claims ?? [];
}

/** Row n of Pascal's triangle mod 2, built by addition alone: its odd entries. */
function oddBinomials(n: number): number {
  let row = [1];
  for (let m = 0; m < n; m++) row = [1, ...row.slice(1).map((v, k) => (v + row[k]) % 2), 1];
  return row.reduce((a, b) => a + b, 0);
}

const popcount = (n: number) => n.toString(2).split('').filter((b) => b === '1').length;

describe('rule-weaver: the oracles of the entry\'s claims', () => {
  const claims = claimsOf('rule-weaver');
  const byId = (id: string) => {
    const c = claims.find((x) => x.id === id);
    expect(c, `catalogue/entries/rule-weaver.md claim ${id}`).toBeDefined();
    return c as Claim;
  };

  const rows = [['rule-90-at-row-63', 63, 64], ['rule-90-at-row-99', 99, 16]] as const;
  for (const [id, n, cells] of rows) {
    it(`${id}: 2^popcount(${n}) = ${cells} live cells, ${share(cells, WIDTH)}`, () => {
      // Lucas: C(n, k) is odd iff the bits of k are a subset of n's, so row n has 2^popcount(n)
      expect(2 ** popcount(n)).toBe(cells);
      expect(oddBinomials(n)).toBe(cells);
      // rule 90 from one cell is that row, spread over 2n + 1 cells, while the fronts have not
      // met round the ring: n < width / 2
      expect(n).toBeLessThan(WIDTH / 2);
      expect(count(weave(90, WIDTH, n))).toBe(cells);
      const c = byId(id);
      expect(c.setup?.params).toEqual({ rule: 90, [RUNS_KEY]: n });
      expect(c.expect).toEqual({ value: Number(((100 * cells) / WIDTH).toFixed(1)) });
    });
  }

  it('rule-184-conserves-its-live-cells: the first row\'s count, exactly', () => {
    for (const id of ['rule-184-conserves-its-live-cells', 'rule-184-conserves-a-sparse-row']) {
      const c = byId(id);
      expect(c.readout).toBe('live cells');
      expect(c.expect).toEqual({ against: 'live cells in the first row', tolerance: 0 });
      expect(c.setup?.params?.rule).toBe(184);
    }
  });
});
