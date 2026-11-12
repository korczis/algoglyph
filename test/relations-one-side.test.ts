// A link is declared once and its reverse derived: no pair of entries may each declare the other.
// catalogue --check refuses one, and scripts/relations-one-side.mjs collapses them by its rule.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue, twoSidedPairs } from '../scripts/lib/catalogue.mjs';

const root = process.cwd();

describe('relations: declared on one side', () => {
  it('twoSidedPairs finds a pair each side declares, and not a prerequisite', () => {
    const pairs = twoSidedPairs([
      { id: 'b', declared: [{ type: 'related_to', target: 'a' }] },
      { id: 'a', declared: [{ type: 'uses', target: 'b' }, { type: 'related_to', target: 'c' }] },
      { id: 'c', declared: [{ type: 'requires', target: 'a' }] },
    ]);
    expect(pairs).toEqual([['a', 'b']]);
  });
});
