// langton-turmites (wave 6): the oracles of the entry's claims, computed here by an ant of this
// file's own on the claims instrument's board, independent of the plate's ant.ts and of its
// highway detector, and compared with the values the claims state.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { RUNS_KEY } from '../src/plates/_shared/settle/settle';
import type { Claim } from './support/claims';

const ID = 'langton-turmites';

/** The entry's claims as the catalogue loads them. */
function claimsOf(id: string): Claim[] {
  type Model = { model: { entries: { id: string; claims: Claim[] }[] } };
  const { model } = loadCatalogue(process.cwd()) as Model;
  return model.entries.find((e) => e.id === id)?.claims ?? [];
}

// the claims instrument's board: 800 × 500 px in cells of 3 px, a torus
const W = Math.floor(800 / 3);
const H = Math.floor(500 / 3);

/**
 * Langton's ant from the centre of an empty W × H torus, heading up: on a white cell it turns a
 * quarter right, on a black one a quarter left, flips the cell and steps forward. Returns the
 * heading of every step (as compass offsets) and the cells it stood on and coloured.
 */
function walk(steps: number) {
  const black = new Uint8Array(W * H);
  const visited = new Uint8Array(W * H);
  // headings clockwise from up, as (dx, dy) with y growing downwards
  const heading: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  let x = Math.floor(W / 2);
  let y = Math.floor(H / 2);
  let d = 0;
  visited[y * W + x] = 1;
  const moves: [number, number][] = [];
  for (let s = 0; s < steps; s++) {
    const i = y * W + x;
    d = (d + (black[i] ? 3 : 1)) % 4;
    black[i] ^= 1;
    const [dx, dy] = heading[d];
    x = (x + dx + W) % W;
    y = (y + dy + H) % H;
    visited[y * W + x] = 1;
    moves.push([dx, dy]);
  }
  return { moves, black, visited };
}

/**
 * The smallest p whose moves repeat over the last `window` steps (move s equals move s − p for
 * every s in it) and whose one period carries the ant somewhere.
 */
function minimalPeriod(moves: [number, number][], window: number): number | null {
  const t = moves.length;
  for (let p = 1; 3 * p <= window; p++) {
    let ok = true;
    for (let s = t - window + p; s < t && ok; s++) {
      ok = moves[s][0] === moves[s - p][0] && moves[s][1] === moves[s - p][1];
    }
    if (!ok) continue;
    let dx = 0;
    let dy = 0;
    for (let s = t - p; s < t; s++) {
      dx += moves[s][0];
      dy += moves[s][1];
    }
    if (dx || dy) return p;
  }
  return null;
}

describe('langton-turmites: the oracles of the entry\'s claims', () => {
  const claims = claimsOf(ID);
  const byId = (id: string) => {
    const c = claims.find((x) => x.id === id);
    expect(c, `catalogue/entries/${ID}.md claim ${id}`).toBeDefined();
    return c as Claim;
  };

  it('highway-period-104: the smallest repeating period that goes somewhere, at step 12000', () => {
    const { moves } = walk(12_000);
    // the last 1500 steps, from step 10 500, about 14 periods, in which the highway is built
    const p = minimalPeriod(moves, 1500);
    expect(p).toBe(104);
    // and not yet over a window reaching back into the chaos before it
    expect(minimalPeriod(moves, 4000)).toBeNull();
    const c = byId('highway-period-104');
    expect(c.readout).toBe('highway (first ant)');
    expect(c.setup?.params).toEqual({ [RUNS_KEY]: 12_000 });
    expect(c.expect).toEqual({ value: p });
  });

  it('visited-covers-coloured: every coloured cell was stood on', () => {
    // a cell changes colour only under an ant, and every cell an ant stands on is visited
    const { black, visited } = walk(12_000);
    let coloured = 0;
    let outside = 0;
    for (let i = 0; i < black.length; i++) {
      coloured += black[i];
      if (black[i] && !visited[i]) outside++;
    }
    expect(coloured).toBeGreaterThan(0);
    expect(outside).toBe(0);
    for (const id of ['visited-covers-coloured', 'visited-covers-coloured-four-ants']) {
      const c = byId(id);
      expect(c.readout).toBe('cells visited');
      // the difference of two whole counts is at least 0: above −1
      expect(c.expect).toEqual({ against: 'coloured cells', above: -1 });
    }
  });
});
