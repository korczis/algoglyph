// A documented wing (catalogue/maturity.yaml, ADR 0006 §4): once a wing's article wave lands,
// every live entry in it keeps reading notes, sources and one of pedagogy, algorithm and bounds.
// Each case copies the real catalogue/ into a private tree, changes one thing, and asks
// scripts/lib/catalogue.mjs what it makes of it.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue, splitFrontMatter } from '../scripts/lib/catalogue.mjs';

const trees: string[] = [];
afterEach(() => { for (const t of trees.splice(0)) rmSync(t, { recursive: true, force: true }); });

/** A private copy of catalogue/, changed by `edit`; code is not read, only the catalogue. */
function errorsAfter(edit: (root: string) => void): string[] {
  const root = mkdtempSync(join(tmpdir(), 'algoglyph-maturity-'));
  trees.push(root);
  cpSync('catalogue', join(root, 'catalogue'), { recursive: true });
  edit(root);
  return loadCatalogue(root, { code: false }).errors;
}

/** Remove pedagogy, algorithm and bounds from an entry's front matter, keeping everything else. */
function stripThirdPiece(root: string, id: string): void {
  const file = join(root, 'catalogue', 'entries', `${id}.md`);
  const text = readFileSync(file, 'utf8');
  const kept: string[] = [];
  let skipping = false;
  for (const line of text.split('\n')) {
    if (/^(pedagogy|algorithm|bounds):/.test(line)) { skipping = true; continue; }
    if (skipping && /^\s/.test(line)) continue;
    skipping = false;
    kept.push(line);
  }
  writeFileSync(file, kept.join('\n'));
}

const documented = (parse(readFileSync('catalogue/maturity.yaml', 'utf8')) as { documented: string[] }).documented;

describe('the documented-wing gate', () => {
  it('lists at least one wing, and the real catalogue passes it', () => {
    expect(documented.length).toBeGreaterThan(0);
    expect(errorsAfter(() => {})).toEqual([]);
  });

  it('refuses a live entry of a documented wing without pedagogy, algorithm or bounds', () => {
    const errors = errorsAfter((root) => stripThirdPiece(root, 'towers-of-hanoi'));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/towers-of-hanoi\.md: live in foundations, a documented wing .* missing one of pedagogy, algorithm, bounds/);
  });

  it('leaves a wing that is not listed alone: its live entries may still be catalogued only', () => {
    const errors = errorsAfter((root) => {
      writeFileSync(join(root, 'catalogue', 'maturity.yaml'), 'documented: []\n');
      stripThirdPiece(root, 'towers-of-hanoi');
    });
    expect(errors).toEqual([]);
  });

  it('refuses a name that is not a wing', () => {
    const errors = errorsAfter((root) => {
      writeFileSync(join(root, 'catalogue', 'maturity.yaml'), 'documented: [foundations, not-a-wing]\n');
    });
    expect(errors).toEqual(['catalogue/maturity.yaml: documented names not-a-wing, which is not a wing of taxonomy.yaml']);
  });

  it('the fixture edit really removes the third piece (the negative case tests what it claims)', () => {
    const root = mkdtempSync(join(tmpdir(), 'algoglyph-maturity-'));
    trees.push(root);
    cpSync('catalogue', join(root, 'catalogue'), { recursive: true });
    stripThirdPiece(root, 'towers-of-hanoi');
    const { head } = splitFrontMatter(readFileSync(join(root, 'catalogue', 'entries', 'towers-of-hanoi.md'), 'utf8'));
    const fm = parse(head) as Record<string, unknown>;
    expect(fm.pedagogy ?? fm.algorithm ?? fm.bounds).toBeUndefined();
    expect(fm.sources).toBeTruthy();
  });
});
