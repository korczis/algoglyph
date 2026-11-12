// Every claim in the catalogue, checked by its own plate (ADR 0007): the instrument in
// test/support/claims.ts runs the plate headless with the claim's setup and seed until its readouts
// settle, reads the named readout and judges it against the claim's expectation. Counted, never
// timed: a claim reads what the plate measures, so it holds on any machine.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { expected, firstNumber, holds, read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

interface Entry { id: string; file: string; claims: Claim[]; status: string }
const { model, errors } = loadCatalogue(process.cwd()) as { model: { entries: Entry[] }; errors: string[] };
const claimed = model.entries.filter((e) => e.claims.length);

describe('the catalogue loads, so its claims are the ones authored', () => {
  it('has no catalogue errors', () => expect(errors).toEqual([]));
});

for (const e of claimed) {
  describe(`claims of ${e.id}`, () => {
    for (const c of e.claims) {
      it(`${c.id}: ${c.statement}`, async () => {
        const r = await read(e.id, c);
        expect(r.reason, `catalogue/entries/${e.id}.md claim ${c.id}`).toBeUndefined();
        expect(holds(c, r.value as number), `catalogue/entries/${e.id}.md claim ${c.id}: "${c.readout}" read ${r.text} (${r.value}), expected ${expected(c)}`).toBe(true);
      }, 120_000);
    }
  });
}

describe('the claims instrument', () => {
  const base: Claim = {
    id: 'probe', statement: 'a probe of the instrument itself',
    readout: '90% intervals covering', expect: { range: [0, 100] },
  };

  it('reads the first number of a readout as displayed', () => {
    expect(firstNumber('89.7% (guarantee: at least 90%)')).toBe(89.7);
    expect(firstNumber('1,000 of 1,000')).toBe(1000);
    expect(firstNumber('−0.25 to 0.5')).toBe(-0.25);
    expect(firstNumber('starting')).toBeNull();
  });

  it('refuses a readout the plate does not publish, naming the ones it does', async () => {
    const r = await read('bootstrap-ci', { ...base, readout: 'No such readout' });
    expect(r.reason).toMatch(/publishes no readout "No such readout"; it publishes: .*"90% intervals covering"/);
  }, 120_000);

  it('refuses a setup parameter the plate does not have', async () => {
    const r = await read('bootstrap-ci', { ...base, setup: { params: { notAParameter: 1 } } });
    expect(r.reason).toBe('setup.params.notAParameter is not a parameter of bootstrap-ci');
  });

  it('fails an expectation the plate does not meet', async () => {
    const r = await read('bootstrap-ci', base);
    expect(r.reason).toBeUndefined();
    expect(holds({ ...base, expect: { range: [0, 100] } }, r.value as number)).toBe(true);
    expect(holds({ ...base, expect: { value: 50, tolerance: 1 } }, r.value as number)).toBe(false);
  }, 120_000);

  it('reads the same value twice for the same seed', async () => {
    const a = await read('conformal-intervals', base);
    const b = await read('conformal-intervals', base);
    expect(a.value).toBeDefined();
    expect(b.value).toBe(a.value);
  }, 120_000);
});

describe('the claims schema', () => {
  const trees: string[] = [];
  afterAll(() => { for (const t of trees) rmSync(t, { recursive: true, force: true }); });
  /** Errors of a private copy of catalogue/ whose bootstrap-ci entry carries `claims` (YAML). */
  function errorsWith(claimsYaml: string): string[] {
    const root = mkdtempSync(join(tmpdir(), 'algoglyph-claims-'));
    trees.push(root);
    cpSync('catalogue', join(root, 'catalogue'), { recursive: true });
    const file = join(root, 'catalogue', 'entries', 'bootstrap-ci.md');
    const text = readFileSync(file, 'utf8').replace(/\nclaims:\n(?: {2}.*\n)+/, '\n');
    writeFileSync(file, text.replace(/\n---\n/, `\n${claimsYaml}---\n`));
    return (loadCatalogue(root, { code: false }) as { errors: string[] }).errors;
  }
  const ok = 'claims:\n  - id: a-claim\n    statement: a statement long enough\n    readout: Some readout\n    expect: { range: [0, 1] }\n';

  it('accepts a well-formed claim', () => expect(errorsWith(ok)).toEqual([]));

  it('refuses a claim without a statement', () => {
    const errs = errorsWith(ok.replace('    statement: a statement long enough\n', ''));
    expect(errs.some((m) => /claims\[0\]\.statement: required/.test(m))).toBe(true);
  });

  it('refuses an expectation with both a value and a range, or neither', () => {
    expect(errorsWith(ok.replace('{ range: [0, 1] }', '{ value: 1, range: [0, 1] }')).join('\n'))
      .toMatch(/expect needs exactly one of value and range/);
    expect(errorsWith(ok.replace('{ range: [0, 1] }', '{ tolerance: 1 }')).join('\n'))
      .toMatch(/expect needs exactly one of value and range/);
  });

  it('refuses a reversed range and a tolerance without a value', () => {
    expect(errorsWith(ok.replace('[0, 1]', '[1, 0]')).join('\n')).toMatch(/expect\.range must be \[lo, hi\]/);
    expect(errorsWith(ok.replace('{ range: [0, 1] }', '{ range: [0, 1], tolerance: 1 }')).join('\n'))
      .toMatch(/expect\.tolerance is a distance around expect\.value/);
  });
});
