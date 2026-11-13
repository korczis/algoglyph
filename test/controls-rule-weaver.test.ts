// rule-weaver (wave 6). Defect D6: the generation readout was one ahead of the row it labels:
// setup painted the first row (generation 0) and then set the counter to 1, so after k steps the
// row shown was generation k and the label read k + 1. Each check here reads the plate through
// the claims instrument (test/support/claims.ts) and compares it with an elementary automaton
// written out below, independent of the plate's own rule.ts.
import { describe, expect, it } from 'vitest';
import type { Params } from '../src/core/plate';
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

/** Elementary rule `rule` on a ring of `width` cells from one live cell, `n` generations on. */
function weave(rule: number, width: number, n: number): Uint8Array {
  let row = new Uint8Array(width);
  row[Math.floor(width / 2)] = 1;
  for (let g = 0; g < n; g++) {
    const next = new Uint8Array(width);
    for (let i = 0; i < width; i++) {
      const l = row[(i + width - 1) % width];
      const r = row[(i + 1) % width];
      next[i] = (rule >> ((l << 2) | (row[i] << 1) | r)) & 1;
    }
    row = next;
  }
  return row;
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
