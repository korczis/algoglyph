// The derived-facts gate (rule project.derived-facts): every number about the collection and
// every link is derived; nothing is typed by hand. The repository itself must pass, so the unit
// suite enforces the rule as well as scripts/check-facts.mjs does.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
// @ts-expect-error -- plain ESM shared with the node tooling
import { derivePlan } from '../scripts/lib/plan.mjs';
// @ts-expect-error -- plain ESM shared with the node tooling
import { gate, loadPolicy, scan } from '../scripts/lib/facts-gate.mjs';

interface Finding { check: string; text: string; line: number }

const root = process.cwd();
const { model } = loadCatalogue(root);
const policy = loadPolicy(root);
const known = model.entries[0].id as string;
const exists = (p: string) => ['docs/ARCHITECTURE.md', 'public/favicon.svg'].includes(p);
const run = (path: string, text: string): Finding[] => scan(path, text, { policy, model, exists });
const checks = (path: string, text: string) => run(path, text).map((f) => f.check);

describe('derived-facts gate: what it refuses', () => {
  it('a number typed next to a collection noun, in digits, words or with a qualifier', () => {
    expect(checks('README.md', 'The site holds 40 plates.')).toEqual(['count']);
    expect(checks('docs/x.md', 'nineteen plates and 96 unit tests')).toEqual(['count', 'count']);
    expect(checks('docs/x.md', 'There are 212 planned entries in 12 wings.')).toEqual(['count', 'count']);
    expect(checks('src/x.ts', '// one of 20 sorting kernels')).toEqual(['count']);
  });

  it('a plate referred to by its number', () => {
    expect(checks('docs/x.md', 'see PL. 042 and plate 12')).toEqual(['plate-number', 'plate-number']);
  });

  it('a route the catalogue does not resolve', () => {
    expect(checks('docs/x.md', 'open #/p/no-such-plate')).toEqual(['link']);
    expect(checks('docs/x.md', 'open #/c/no-such-wing')).toEqual(['link']);
    expect(checks('docs/x.md', 'open #/lab/no-such-lab')).toEqual(['link']);
  });

  it('a relative link or a repository path that names no file', () => {
    expect(checks('docs/y.md', 'see [it](./MISSING.md)')).toEqual(['path']);
    expect(checks('docs/y.md', 'in `src/no/such/file.ts`')).toEqual(['path']);
  });
});

describe('derived-facts gate: what it allows', () => {
  it('a route to a catalogued id, and a route built in code', () => {
    expect(run('docs/x.md', `open #/p/${known}`)).toEqual([]);
    expect(run('index.html', `<a :href="'#/p/' + e.id">`)).toEqual([]);
    expect(run('src/x.ts', 'go(`#/p/${p.id}`)')).toEqual([]);
  });

  it('existing files, placeholders and external links', () => {
    expect(run('docs/y.md', 'see [it](./ARCHITECTURE.md), `src/kernels/<engine>/<id>.ts`, https://x.y/z')).toEqual([]);
    expect(run('index.html', '<link rel="icon" href="./favicon.svg">')).toEqual([]);
  });

  it('numbers inside derived regions', () => {
    const text = '<!-- algoglyph:derived:begin counts -->\n40 plates\n<!-- algoglyph:derived:end counts -->';
    expect(run('README.md', text)).toEqual([]);
  });

  it('a count pinned to the run or commit it was measured on', () => {
    expect(run('.github/workflows/ci.yml', '# Measured: run 43083820780 (19 plates) took 1311 s')).toEqual([]);
    expect(run('x.yaml', `result: "96 tests at ${'a'.repeat(40)}"`)).toEqual([]);
  });

  it('YAML record subtrees and closed plan objects', () => {
    expect(run('.ai/repo/project/issues/IX.yaml', 'title: t\nevidence:\n  - result: "96 tests"\n')).toEqual([]);
    expect(run('.ai/repo/project/issues/IX.yaml', 'title: "Eleven plates"\ncompleted_at: 2026-11-11T00:00:00Z\n')).toEqual([]);
    expect(checks('.ai/repo/project/issues/IX.yaml', 'title: "Eleven plates"\n')).toEqual(['count']);
  });

  it('facts of an algorithm itself', () => {
    expect(run('catalogue/entries/x.md', 'Dempster combines two sources; eight queens has 92 solutions; 2ⁿ − 1 moves.')).toEqual([]);
  });

  it('declared exemptions, each with a reason', () => {
    expect(run('.ai/repo/adrs/0001-x.md', 'The collection had 19 plates.')).toEqual([]);
    for (const x of policy.exempt) expect(x.because.length).toBeGreaterThan(20);
  });
});

describe('derived-facts gate: local state is not judged', () => {
  it('a path the repository ignores passes whether or not this checkout has it', () => {
    // a fresh CI checkout has no .ai/local/; Majordomus's generated projections still name it
    const withIgnored = (p: string) => p.startsWith('.ai/local');
    expect(scan('AGENTS.md', 'never `.ai/local/`', { policy, model, exists: withIgnored })).toEqual([]);
    expect(checks('AGENTS.md', 'never `.ai/notthere/`')).toEqual(['path']);
  });
});

describe('derived-facts gate: root causes stay fixed', () => {
  it('the generated plan states no count (a stored number is a copy that drifts)', () => {
    const { milestones, issues } = derivePlan(model);
    const text = JSON.stringify({ milestones, issues });
    expect(text).not.toMatch(/\b\d+ algorithm/);
  });

  it('the lab minimum is one constant the site reads, not a number in a message', () => {
    expect(model.labMin).toBeGreaterThan(1);
  });

  it('this repository passes the gate', () => {
    const { findings } = gate(root, model) as { findings: (Finding & { file: string })[] };
    expect(findings.map((f) => `${f.check} ${f.file}:${f.line} ${f.text}`)).toEqual([]);
  });
});
