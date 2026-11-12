// Figure occurrences of cited works (ADR 0009): the chapter documents load and validate, every
// figure's setup is made of its plate's own parameters, nothing is routed without a source review,
// and a figure route and its link round-trip through the one router and the one serialiser.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parse as parseYaml, stringify } from 'yaml';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadCatalogue } from '../scripts/lib/catalogue.mjs';
// @ts-expect-error -- plain ESM shared with the node tooling
import { loadFigures } from '../scripts/lib/figures.mjs';
import { CATALOGUE, type Chapter, type Collection } from '../src/core/catalogue';
import { defaults } from '../src/core/plate';
import { parseRoute } from '../src/core/route';
import { parse, serialise } from '../src/core/share';
import { loadPlate } from '../src/registry';

const ROOT = process.cwd();
const tmp = mkdtempSync(join(tmpdir(), 'figures-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** The real catalogue's figure model with the III/1 chapter given a review, as after the read. */
function reviewed(): { collections: Collection[]; chapters: Chapter[]; errors: string[] } {
  const root = join(tmp, 'reviewed');
  mkdirSync(join(root, 'catalogue'), { recursive: true });
  cpSync(join(ROOT, 'catalogue'), join(root, 'catalogue'), { recursive: true });
  const file = join(root, 'catalogue', 'figures', 'feynman-III-01.yaml');
  const doc = parseYaml(readFileSync(file, 'utf8'));
  doc.review = { by: 'a test', date: '2026-11-12', method: 'manual-read' };
  writeFileSync(file, stringify(doc));
  const { model } = loadCatalogue(ROOT, { code: true });
  const errors: string[] = [];
  const sources = new Map(model.sources.map((s: { id: string }) => [s.id, s]));
  const out = loadFigures(root, { entries: structuredClone(model.entries), sources, errors });
  return { ...out, errors };
}

describe('figure chapters', () => {
  const { model, errors } = loadCatalogue(ROOT) as { model: typeof CATALOGUE; errors: string[] };

  it('load without errors and name live entries', () => {
    expect(errors).toEqual([]);
    expect(model.chapters.length).toBeGreaterThan(0);
    for (const c of model.chapters) for (const f of c.figures) expect(model.entries.some((e) => e.id === f.plate)).toBe(true);
  });

  it('route no figure of a chapter without a source review', () => {
    for (const c of model.chapters) if (!c.review) for (const f of c.figures) expect(f.routed, `${c.key} ${f.id}`).toBe(false);
  });

  it('set up each figure with its own plate’s parameters, inside their controls', async () => {
    for (const c of model.chapters) {
      for (const f of c.figures) {
        const plate = await loadPlate(f.plate);
        expect(plate, f.plate).toBeDefined();
        for (const [k, v] of Object.entries(f.setup)) {
          const d = plate!.params.find((x) => x.key === k);
          expect(d, `${c.key} ${f.id}: ${k} is not a parameter of ${f.plate}`).toBeDefined();
          if (d!.kind === 'select') expect(d!.options.map((o) => o.value)).toContain(v);
          if (d!.kind === 'range') {
            expect(Number(v)).toBeGreaterThanOrEqual(d!.min);
            expect(Number(v)).toBeLessThanOrEqual(d!.max);
          }
        }
      }
    }
  });

  it('once reviewed, route every figure on a live tested plate, in order, with backlinks', () => {
    const r = reviewed();
    expect(r.errors).toEqual([]);
    const ch = r.chapters.find((c) => c.key === 'III/01')!;
    expect(ch.figures.every((f) => f.routed)).toBe(true);
    const ids = ch.figures.map((f) => f.id);
    ch.figures.forEach((f, i) => {
      expect(f.prev).toBe(i > 0 ? ids[i - 1] : null);
      expect(f.next).toBe(i < ids.length - 1 ? ids[i + 1] : null);
      expect(f.route).toBe(`#/feynman/III/01/${f.id}`);
    });
  });

  it('refuse a malformed chapter with a reason per fault', () => {
    const root = join(tmp, 'bad');
    mkdirSync(join(root, 'catalogue', 'figures'), { recursive: true });
    cpSync(join(ROOT, 'catalogue', 'schema'), join(root, 'catalogue', 'schema'), { recursive: true });
    writeFileSync(join(root, 'catalogue', 'figures', 'collections.yaml'), stringify({ version: 1, collections: [
      { id: 'feynman', title: 'Feynman Lab', work: 'feynman-lectures', summary: 'A collection used by the test only.' },
      { id: 'lab', title: 'Clash', work: 'feynman-lectures', summary: 'A collection that takes a route of the site.' },
    ] }));
    const fig = { id: '1-1', section: '1-2', class: 'thought-experiment', title: 'A figure', paraphrase: 'Something the figure shows, in our words.', plate: 'two-slit-classical' };
    writeFileSync(join(root, 'catalogue', 'figures', 'feynman-III-01.yaml'), stringify({
      schema: 'algoglyph.figures/v1', collection: 'feynman', volume: 'III', chapter: 2, title: 'Wrong',
      url: 'https://example.invalid/III_01.html',
      figures: [fig, fig, { ...fig, id: '2-1', plate: 'no-such-plate' }, { ...fig, id: '1-9', colour: 'red' }],
    }));
    writeFileSync(join(root, 'catalogue', 'figures', 'feynman-3.yaml'), 'schema: algoglyph.figures/v1\n');
    const { model } = loadCatalogue(ROOT);
    const errors: string[] = [];
    loadFigures(root, { entries: structuredClone(model.entries), sources: new Map([['feynman-lectures', {}]]), errors });
    const text = errors.join('\n');
    expect(text).toContain('lab is a route of its own');
    expect(text).toContain('feynman-3.yaml: a chapter file is named');
    expect(text).toContain('colour: unknown field');
    // the shape errors stop the chapter before its semantics; fix them and the rest is judged
    writeFileSync(join(root, 'catalogue', 'figures', 'feynman-III-01.yaml'), stringify({
      schema: 'algoglyph.figures/v1', collection: 'feynman', volume: 'III', chapter: 2, title: 'Wrong',
      url: 'https://example.invalid/III_01.html',
      figures: [fig, fig, { ...fig, id: '2-1', plate: 'no-such-plate' }],
    }));
    const again: string[] = [];
    loadFigures(root, { entries: structuredClone(model.entries), sources: new Map([['feynman-lectures', {}]]), errors: again });
    const t2 = again.join('\n');
    expect(t2).toContain('must match the file name');
    expect(t2).toContain('figure 1-1 is recorded twice');
    expect(t2).toContain('no-such-plate is not a catalogue entry');
    expect(t2).toContain('figure 1-1 is not numbered in chapter 2');
  });
});

describe('figure routes and links', () => {
  const r = reviewed();
  const model = { collections: r.collections, chapters: r.chapters };

  it('resolve a routed figure to its plate, and its chapter and collection to the index', () => {
    const fig = parseRoute('#/feynman/III/01/1-4?seed=42&eta=0.5', model);
    expect(fig).toMatchObject({ view: 'figure', key: 'feynman/III/01/1-4', id: 'two-slit-amplitudes', seed: 42 });
    expect(parseRoute('#/feynman/III/01', model)).toMatchObject({ view: 'figures', key: 'feynman/III/01' });
    expect(parseRoute('#/feynman', model)).toMatchObject({ view: 'figures', key: 'feynman' });
  });

  it('send an unknown or unrouted figure to the collection, never to a plate', () => {
    for (const h of ['#/feynman/III/01/1-9', '#/feynman/III/02/1-1', '#/feynman/III/01/1-4/x', '#/nothing/III/01/1-1']) {
      expect(parseRoute(h, model).view, h).toBe('browse');
    }
    // the shipped catalogue has no review yet: nothing of the chapter resolves
    expect(parseRoute('#/feynman/III/01/1-3').view).toBe('browse');
    expect(parseRoute('#/feynman').view).toBe('browse');
  });

  it('leave the plate and lab routes as they were', () => {
    expect(parseRoute('#/p/two-slit-amplitudes?seed=7', model)).toMatchObject({ view: 'plate', id: 'two-slit-amplitudes', seed: 7 });
    expect(parseRoute('#/p/%E0%A4%A', model).view).toBe('browse');
  });

  it('write a figure link relative to its setup, and read it back to the same parameters', async () => {
    const plate = (await loadPlate('two-slit-amplitudes'))!;
    const fig = r.chapters[0].figures.find((f) => f.id === '1-4')!;
    const base = { ...defaults(plate), ...fig.setup };
    expect(serialise(plate.params, base, 42, fig.setup)).toBe('seed=42');
    const changed = { ...base, eta: 0.5 };
    const q = serialise(plate.params, changed, 42, fig.setup);
    expect(q).toBe('seed=42&eta=0.5');
    // a plate link of the same state names every parameter the setup changed
    expect(serialise(plate.params, changed, 42)).toContain('scenario=watched');
    const back = { ...defaults(plate), ...fig.setup, ...parse(plate.params, q).params };
    expect(back).toEqual(changed);
  });
});
