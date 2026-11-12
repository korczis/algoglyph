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

  it('the catalogue declares no link on both sides', () => {
    const { errors } = loadCatalogue(root, { code: false });
    expect((errors as string[]).filter((e) => e.includes('each declare the other'))).toEqual([]);
  });

  it('the collapse script has nothing left to do', () => {
    const out = execFileSync('node', ['scripts/relations-one-side.mjs', '--check'], { cwd: root, encoding: 'utf8' });
    expect(out).toContain('0 two-sided pair(s)');
  });
});
