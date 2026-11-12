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
import { expected, firstNumber, holds, nthNumber, read, type Claim } from './support/claims';
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

// A figure's claims (ADR 0009) are read by the same instrument on the figure's plate, with the
// figure's setup under each claim's own: the claim's parameters win where both name one. They
// run whether or not the figure's page is routed, so a setup's physics is gated before its page.
interface FigureClaims { id: string; plate: string; setup: Record<string, unknown>; claims: Claim[] }
const figures = ((model as unknown as { chapters?: { collection: string; key: string; figures: FigureClaims[] }[] }).chapters ?? [])
  .flatMap((c) => c.figures.filter((f) => f.claims.length).map((f) => ({ ...f, at: `${c.collection}/${c.key}/${f.id}` })));

/** A figure's claim as the instrument reads it: the figure's setup, then the claim's own. */
function underFigure(setup: Record<string, unknown> | undefined, c: Claim): Claim {
  return { ...c, setup: { ...c.setup, params: { ...(setup ?? {}), ...(c.setup?.params ?? {}) } as never } };
}

for (const f of figures) {
  describe(`claims of figure ${f.at}`, () => {
    for (const c of f.claims) {
      it(`${c.id}: ${c.statement}`, async () => {
        const claim = underFigure(f.setup, c);
        const r = await read(f.plate, claim);
        expect(r.reason, `figure ${f.at} claim ${c.id}`).toBeUndefined();
        expect(holds(claim, r.value as number), `figure ${f.at} claim ${c.id}: "${c.readout}" read ${r.text} (${r.value}), expected ${expected(claim)}`).toBe(true);
      }, 120_000);
    }
  });
}

describe('a figure claim under its figure', () => {
  it('takes the figure setup, with the claim’s own parameters winning', () => {
    const c: Claim = { id: 'x', statement: 'a probe of the merge itself', readout: 'r', expect: { value: 1 },
      setup: { params: { eta: 0.5 }, seed: 9 } };
    const m = underFigure({ scenario: 'watched', eta: 1 }, c);
    expect(m.setup).toEqual({ params: { scenario: 'watched', eta: 0.5 }, seed: 9 });
  });
});

describe('the claims instrument', () => {
  const base: Claim = {
    id: 'probe', statement: 'a probe of the instrument itself',
    readout: '90% intervals covering', expect: { range: [0, 100] },
  };

  it('reads the first number of a readout as displayed', () => {
    expect(firstNumber('89.7% (guarantee: at least 90%)')).toBe(89.7);
    expect(firstNumber('92.7% ± 2.1%')).toBe(92.7);
    expect(firstNumber('1,000 of 1,000')).toBe(1000);
    expect(firstNumber('1,234.5 draws')).toBe(1234.5);
    expect(firstNumber('−0.25 to 0.5')).toBe(-0.25);
    // toExponential and toPrecision print exponents; reading 3.2 would be wrong by 10⁷
    expect(firstNumber('3.2e-7')).toBe(3.2e-7);
    expect(firstNumber('largest error 1.25e+3 dB')).toBe(1250);
    expect(firstNumber('−4.0e−2')).toBe(-0.04);
    // no engine prints a power of ten in this form; it is refused rather than read as 1.5
    expect(firstNumber('1.5×10⁻³')).toBeNull();
    expect(firstNumber('starting')).toBeNull();
    expect(nthNumber('1.657392 = v(all) − v(none) 1.657392', 2)).toBe(1.657392);
    expect(nthNumber('0.1220 → 0.0324', 2)).toBe(0.0324);
    expect(nthNumber('0.1220 → 0.0324', 3)).toBeNull();
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
    // one-sided claims are strict
    expect(holds({ ...base, expect: { below: r.value as number } }, r.value as number)).toBe(false);
    expect(holds({ ...base, expect: { above: (r.value as number) - 1 } }, r.value as number)).toBe(true);
  }, 120_000);

  it('compares two readouts, or two numbers of one readout, and refuses a missing side', async () => {
    const vs: Claim = { ...base, readout: 'Posterior mean', expect: { against: 'Closed form Beta mean', tolerance: 0.0025 } };
    const r = await read('bayes-update', vs);
    expect(r.reason).toBeUndefined();
    expect(holds(vs, r.value as number)).toBe(true);
    expect(holds({ ...vs, expect: { against: 'Closed form Beta mean', tolerance: 0 } }, 1e-3)).toBe(false);
    const gone = await read('bayes-update', { ...vs, expect: { against: 'No such readout', tolerance: 1 } });
    expect(gone.reason).toMatch(/publishes no readout "No such readout" to compare with/);
    const third = await read('bayes-update', { ...vs, expect: { against: 'Closed form Beta mean', against_number: 9, tolerance: 1 } });
    expect(third.reason).toMatch(/has no number 9/);
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
      .toMatch(/expect needs exactly one of value, range, below and above/);
    expect(errorsWith(ok.replace('{ range: [0, 1] }', '{ tolerance: 1 }')).join('\n'))
      .toMatch(/expect needs exactly one of value, range, below and above/);
    expect(errorsWith(ok.replace('{ range: [0, 1] }', '{ below: 1, above: 0 }')).join('\n'))
      .toMatch(/expect needs exactly one of value, range, below and above/);
    expect(errorsWith(ok.replace('{ range: [0, 1] }', '{ below: 1 }'))).toEqual([]);
  });

  it('refuses a comparison with a value or range, or with no judgement, and a stray against_number', () => {
    const vs = (x: string) => errorsWith(ok.replace('{ range: [0, 1] }', x)).join('\n');
    expect(vs('{ against: Other, tolerance: 0.1 }')).toBe('');
    expect(vs('{ against: Other, value: 1, tolerance: 0.1 }')).toMatch(/expect\.against needs exactly one of tolerance, below and above, and no value or range/);
    expect(vs('{ against: Other }')).toMatch(/expect\.against needs exactly one of tolerance, below and above/);
    expect(vs('{ against: Other, above: 0, against_number: 0 }')).toMatch(/expect\.against_number counts from 1/);
    expect(vs('{ range: [0, 1], against_number: 2 }')).toMatch(/expect\.against_number needs expect\.against/);
  });

  it('refuses a reversed range and a tolerance without a value', () => {
    expect(errorsWith(ok.replace('[0, 1]', '[1, 0]')).join('\n')).toMatch(/expect\.range must be \[lo, hi\]/);
    expect(errorsWith(ok.replace('{ range: [0, 1] }', '{ range: [0, 1], tolerance: 1 }')).join('\n'))
      .toMatch(/expect\.tolerance is a distance around expect\.value/);
  });
});
