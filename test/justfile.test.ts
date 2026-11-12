// The justfile is the entry point for every task (ADR 0005 §6) and delegates to the npm scripts
// and the Cargo workspace, so none of them can drift: every script of package.json is run by a
// recipe, every script and crate a recipe names exists, and every `just <recipe>` the docs name
// is a recipe. Every side is read from the files themselves; nothing is listed here.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** The workspace packages a recipe line names with `cargo ... -p <package>`. */
const packages = (lines: string[]) => new Set(lines.flatMap((l) =>
  [...l.matchAll(/\bcargo\b.*?\s-p\s+([\w-]+)/g)].map((m) => m[1])));

const recipeLines = justfile.split('\n').filter((l) => /^\s+\S/.test(l));
/** A recipe header: a name at the start of a line, its parameters, then `:` (not `:=`). */
const recipeNames = new Set([...justfile.matchAll(/^([a-z][\w-]*)(?:\s[^:\n]*)?:(?!=)/gm)]
  .map((m) => m[1]));

/** The package names of the Cargo workspace's members (Cargo.toml `members`). */
const members = (() => {
  const root = readFileSync('Cargo.toml', 'utf8');
  const list = /members\s*=\s*\[([^\]]*)\]/.exec(root)?.[1] ?? '';
  return new Set([...list.matchAll(/"([^"]+)"/g)].map((m) =>
    /^name\s*=\s*"([^"]+)"/m.exec(readFileSync(join(m[1], 'Cargo.toml'), 'utf8'))?.[1]));
})();

/** Every `just <recipe>` in the docs' code: inline code spans and fenced code lines. */
const docs = ['README.md', ...readdirSync('docs').map((f) => `docs/${f}`),
  ...readdirSync('.ai/repo/rules/project').map((f) => `.ai/repo/rules/project/${f}`)]
  .filter((f) => f.endsWith('.md'));
const named = docs.flatMap((file) => {
  const text = readFileSync(file, 'utf8');
  const code = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].flatMap((m) => m[1].split('\n'))
    .concat([...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]));
  return code.flatMap((c) => [...c.matchAll(/^\s*just\s+([a-z][\w-]*)/g)])
    .map((m) => ({ file, recipe: m[1] }));
});

interface Recipe { name: string; doc: string | null; attributes: unknown[]; body: unknown[][] }
const dump = spawnSync('just', ['--dump', '--dump-format', 'json'], { encoding: 'utf8' });
const recipes: Recipe[] | null = dump.status === 0
  ? Object.values(JSON.parse(dump.stdout).recipes as Record<string, Recipe>)
  : null;
// CI installs just (.github/actions/setup): there a missing just fails instead of skipping
const skipJust = recipes === null && !process.env.CI;

describe('justfile, package.json, the Cargo workspace and the docs', () => {
  it('every npm script is run by a recipe', () => {
    const covered = runs(recipeLines);
    expect(scripts.filter((s) => !hook(s) && !covered.has(s))).toEqual([]);
  });

  it('every script a recipe runs exists in package.json', () => {
    expect([...runs(recipeLines)].filter((s) => !scripts.includes(s))).toEqual([]);
  });

  it('every package a cargo recipe names is a member of the workspace', () => {
    const named = packages(recipeLines);
    expect(named.size).toBeGreaterThan(0);
    expect([...named].filter((p) => !members.has(p))).toEqual([]);
  });

  it('every recipe the docs name exists', () => {
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((n) => !recipeNames.has(n.recipe))).toEqual([]);
  });

  it.skipIf(skipJust)('just is installed and reads the recipes this test reads', () => {
    expect(recipes, 'just is not installed').not.toBeNull();
    expect(recipes!.map((r) => r.name).sort()).toEqual([...recipeNames].sort());
    const bodies = recipes!.flatMap((r) => r.body.map((parts) => parts.join('')));
    expect([...runs(bodies)].sort()).toEqual([...runs(recipeLines)].sort());
    expect([...packages(bodies)].sort()).toEqual([...packages(recipeLines)].sort());
  });

  it.skipIf(skipJust)('every recipe has a doc and a group', () => {
    expect(recipes, 'just is not installed').not.toBeNull();
    const group = (r: Recipe) => r.attributes
      .some((a) => typeof a === 'object' && a !== null && 'group' in a);
    const missing = recipes!.filter((r) => r.name !== 'default' && (!r.doc || !group(r)));
    expect(missing.map((r) => r.name)).toEqual([]);
  });
});
