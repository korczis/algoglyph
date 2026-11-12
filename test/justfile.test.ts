// The justfile is the entry point for every task (ADR 0005 §6) and delegates to the npm scripts,
// so the two cannot drift: every script of package.json is run by a recipe, and every script a
// recipe runs exists. Both sides are read from the files themselves; nothing is listed here.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const scripts = Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).scripts as object);
const justfile = readFileSync('justfile', 'utf8');

/** npm runs pre<x> and post<x> itself, around <x>: a hook of a script, not a task of its own. */
const hook = (name: string) => {
  const m = /^(?:pre|post)(.+)$/.exec(name);
  return m !== null && scripts.includes(m[1]);
};

/** The scripts a recipe line runs: `npm run <script>` and `npm test`. */
const runs = (lines: string[]) => new Set(lines.flatMap((l) =>
  [...l.matchAll(/\bnpm (?:run ([\w:-]+)|(test))\b/g)].map((m) => m[1] ?? m[2])));

const recipeLines = justfile.split('\n').filter((l) => /^\s+\S/.test(l));

interface Recipe { name: string; doc: string | null; attributes: unknown[]; body: unknown[][] }
const dump = spawnSync('just', ['--dump', '--dump-format', 'json'], { encoding: 'utf8' });
const recipes: Recipe[] | null = dump.status === 0
  ? Object.values(JSON.parse(dump.stdout).recipes as Record<string, Recipe>)
  : null;

describe('justfile and package.json', () => {
  it('every npm script is run by a recipe', () => {
    const covered = runs(recipeLines);
    expect(scripts.filter((s) => !hook(s) && !covered.has(s))).toEqual([]);
  });

  it('every script a recipe runs exists in package.json', () => {
    expect([...runs(recipeLines)].filter((s) => !scripts.includes(s))).toEqual([]);
  });

  // just is a developer's tool; CI runs the npm scripts, so these run where just is installed
  it.skipIf(recipes === null)('just reads the same recipe bodies this test reads', () => {
    const bodies = recipes!.flatMap((r) => r.body.map((parts) => parts.join('')));
    expect([...runs(bodies)].sort()).toEqual([...runs(recipeLines)].sort());
  });

  it.skipIf(recipes === null)('every recipe has a doc and a group', () => {
    const group = (r: Recipe) => r.attributes
      .some((a) => typeof a === 'object' && a !== null && 'group' in a);
    const missing = recipes!.filter((r) => r.name !== 'default' && (!r.doc || !group(r)));
    expect(missing.map((r) => r.name)).toEqual([]);
  });
});
