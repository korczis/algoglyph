// The sidecar fallback: an array entry with no kernel file may be played by the adapter of a
// catalogue/<family>-sidecar.yaml that maps it. Each case copies the fixture tree under
// test/fixtures/kernel-sidecar, changes one thing, and asks the catalogue (scripts/lib) and the
// registry (src/registry.ts) what they make of it.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM shared with the node tooling
import { discoverCode, loadCatalogue } from '../scripts/lib/catalogue.mjs';
import { kernelLoader, type Backing, type KernelSources } from '../src/registry';
import { sidecarKernel } from './fixtures/kernel-sidecar/src/kernels/sorting-wasm/index';

const FIXTURE = join(import.meta.dirname, 'fixtures', 'kernel-sidecar');
const SIDECAR = 'catalogue/sorting-sidecar.yaml';
const ADAPTER = './kernels/sorting-wasm/index.ts';
const trees: string[] = [];

/** A private copy of the fixture tree, changed by `edit`. */
function tree(edit: (root: string) => void = () => {}): string {
  const root = mkdtempSync(join(tmpdir(), 'algoglyph-sidecar-'));
  trees.push(root);
  cpSync(FIXTURE, root, { recursive: true });
  // the catalogue's own schema and relation table, never a copy that could drift (ADR 0005)
  for (const f of ['catalogue/schema/entry.yaml', 'catalogue/relations.yaml']) cpSync(f, join(root, f));
  // a live entry needs a test (ADR 0005 §3): the fixture's entries stand on the array engine's
  // harness, written here rather than in the fixture so the runner never collects it
  mkdirSync(join(root, 'test'), { recursive: true });
  writeFileSync(join(root, 'test', 'kernels-array.test.ts'), '// the array harness of a fixture tree\n');
  edit(root);
  return root;
}

interface Loaded {
  errors: string[];
  model: { sidecar: Record<string, Backing> };
}
const load = (root: string): Loaded => loadCatalogue(root);

/** The registry's inputs for a tree: its kernel files, its catalogue's mappings, an adapter. */
const FAKE: KernelSources['adapters'] = { [ADAPTER]: async () => sidecarKernel };
function sources(root: string, adapters = FAKE): KernelSources {
  const found = discoverCode(root) as { kernels: { engine: string; id: string }[] };
  const kernels = Object.fromEntries(found.kernels.map((k) =>
    [`./kernels/${k.engine}/${k.id}.ts`, async () => ({ file: `${k.engine}/${k.id}` })]));
  return { kernels, backing: load(root).model.sidecar, adapters };
}

const append = (root: string, yaml: string) =>
  writeFileSync(join(root, SIDECAR), `${yaml}\n`, { flag: 'a' });

afterEach(() => {
  for (const t of trees.splice(0)) rmSync(t, { recursive: true, force: true });
});

describe('sidecar fallback: the fixture as authored', () => {
  it('is a valid catalogue that maps exactly the array entries with no kernel file', () => {
    const { errors, model } = load(tree());
    expect(errors).toEqual([]);
    const backing = (kernel: string) => ({ sidecar: SIDECAR, adapter: 'sorting-wasm', kernel });
    // fixture-planned-sort: a mapping allows `live` and does not demand it
    expect(model.sidecar).toEqual({
      'fixture-wasm-sort': backing('fixture-wasm-kernel'),
      'fixture-planned-sort': backing('fixture-planned-kernel'),
    });
  });

  it('does not take the adapter directory for kernels of its own', () => {
    const found = discoverCode(tree()) as { kernels: { engine: string; id: string }[] };
    expect(found.kernels).toEqual([
      { engine: 'array', id: 'fixture-file-sort' },
      { engine: 'array', id: 'fixture-kept-sort' },
    ]);
  });

  it('resolves a mapped id with no file to the adapter, asked for that id', async () => {
    const root = tree();
    const k = await kernelLoader({ id: 'fixture-wasm-sort', engine: 'array' }, sources(root))();
    expect(k).toMatchObject({ entryId: 'fixture-wasm-sort' });
  });

  it('keeps the kernel file of an entry whose record says existing', async () => {
    const root = tree();
    const k = await kernelLoader({ id: 'fixture-kept-sort', engine: 'array' }, sources(root))();
    expect(k).toEqual({ file: 'array/fixture-kept-sort' });
  });

  it('fails clearly when a mapping asks for an adapter that is not in the tree', () => {
    const root = tree();
    expect(() => kernelLoader({ id: 'fixture-wasm-sort', engine: 'array' }, sources(root, {})))
      .toThrow(`fixture-wasm-sort: ${SIDECAR} maps it, but src/kernels/sorting-wasm/index.ts `
        + 'does not exist');
  });
});

describe('sidecar fallback: what it refuses', () => {
  it('a live array entry with no kernel file and no mapping', () => {
    const root = tree((r) => writeFileSync(join(r, SIDECAR), 'version: 1\n\nentries: []\n'));
    expect(load(root).errors).toEqual([`catalogue/entries/fixture-wasm-sort.md: live, but `
      + `src/kernels/array/fixture-wasm-sort.ts does not exist and no ${SIDECAR} maps it`]);
    expect(() => kernelLoader({ id: 'fixture-wasm-sort', engine: 'array' }, sources(root)))
      .toThrow('fixture-wasm-sort: no src/kernels/array/fixture-wasm-sort.ts');
  });

  it('a mapping to an entry the catalogue does not have, naming both', () => {
    const root = tree((r) => append(r, '  - { id: fixture-no-entry, kernel: k, engine: array }'));
    expect(load(root).errors).toEqual([`${SIDECAR}: fixture-no-entry -> kernel k: `
      + 'no catalogue entry catalogue/entries/fixture-no-entry.md']);
  });

  it('a mapping to an entry of another engine, naming both', () => {
    const root = tree((r) => append(r, '  - { id: fixture-described, kernel: k, engine: array }'));
    expect(load(root).errors).toContain(`${SIDECAR}: fixture-described -> kernel k runs `
      + 'engine array, but catalogue/entries/fixture-described.md names engine custom');
  });

  it('a mapped id that also has a kernel file', () => {
    const root = tree((r) => cpSync(join(r, 'src/kernels/array/fixture-file-sort.ts'),
      join(r, 'src/kernels/array/fixture-wasm-sort.ts')));
    expect(load(root).errors).toEqual([`${SIDECAR}: fixture-wasm-sort -> kernel `
      + 'fixture-wasm-kernel: src/kernels/array/fixture-wasm-sort.ts implements fixture-wasm-sort '
      + 'too; one implementation per entry (delete the file, or mark the record existing)']);
    // and the registry, handed both, refuses to pick one
    const s = sources(root);
    s.backing['fixture-wasm-sort'] = { sidecar: SIDECAR, adapter: 'sorting-wasm', kernel: 'k' };
    expect(() => kernelLoader({ id: 'fixture-wasm-sort', engine: 'array' }, s))
      .toThrow(`fixture-wasm-sort: src/kernels/array/fixture-wasm-sort.ts and ${SIDECAR} both `
        + 'implement it');
  });

  it('a kernel its module does not have, naming the manifest', () => {
    const root = tree((r) => writeFileSync(join(r, SIDECAR), 'version: 1\n\nentries:\n'
      + '  - { id: fixture-wasm-sort, kernel: fixture-wasm-kernal, engine: array }\n'));
    expect(load(root).errors).toEqual([`${SIDECAR}: fixture-wasm-sort -> kernel fixture-wasm-kernal: `
      + 'crates/algoglyph-kernels/src/sorting/kernels.json lists no kernel fixture-wasm-kernal',
    // and the entry it was meant to play is then live with nothing behind it
    'catalogue/entries/fixture-wasm-sort.md: live, but src/kernels/array/fixture-wasm-sort.ts '
      + `does not exist and no ${SIDECAR} maps it`]);
  });

  it('a sidecar whose module has no manifest', () => {
    const root = tree((r) => rmSync(join(r, 'crates'), { recursive: true }));
    expect(load(root).errors[0]).toMatch(new RegExp(`^${SIDECAR}: its module's manifest `
      + 'crates/algoglyph-kernels/src/sorting/kernels.json cannot be read'));
  });

  it('existing: true on an entry whose own code does not exist', () => {
    const root = tree((r) => append(r, '  - { id: fixture-planned-sort, kernel: k, engine: array, existing: true }'));
    expect(load(root).errors).toContain(`${SIDECAR}: fixture-planned-sort -> kernel k: existing: true, `
      + "but src/kernels/array/fixture-planned-sort.ts does not exist; existing means the entry's own code plays");
  });

  it('a second record for an entry that is not existing', () => {
    const root = tree((r) => append(r, '  - { id: fixture-wasm-sort, kernel: k, engine: array }'));
    expect(load(root).errors).toContain(`${SIDECAR}: fixture-wasm-sort has 2 records `
      + '(fixture-wasm-kernel, k); an entry is played by one kernel, unless every record says existing: true');
  });

  it('an in-place tag its kernel does not declare', () => {
    const root = tree((r) => {
      const f = join(r, 'catalogue/entries/fixture-wasm-sort.md');
      writeFileSync(f, readFileSync(f, 'utf8').replace('  - fixture\n', '  - fixture\n  - in-place\n'));
    });
    expect(load(root).errors).toEqual(['catalogue/entries/fixture-wasm-sort.md: tagged in-place, but '
      + 'its kernel fixture-wasm-kernel declares in_place false (crates/algoglyph-kernels/src/sorting/kernels.json)']);
  });

  it('a max_n measured on another source of its kernel, or off the slider grid', () => {
    const set = (r: string, maxN: string) => writeFileSync(join(r, SIDECAR), 'version: 1\n\nentries:\n'
      + `  - { id: fixture-wasm-sort, kernel: fixture-wasm-kernel, engine: array, ${maxN} }\n`);
    expect(load(tree((r) => set(r, 'max_n: 64, max_n_of: "00000000000000aa"'))).errors).toEqual([]);
    expect(load(tree((r) => set(r, 'max_n: 64, max_n_of: "00000000000000bb"'))).errors[0]).toMatch(
      /fixture-wasm-sort -> kernel fixture-wasm-kernel: max_n 64 was measured on source 00000000000000bb, the kernel is now 00000000000000aa/);
    expect(load(tree((r) => set(r, 'max_n: 60, max_n_of: "00000000000000aa"'))).errors[0])
      .toMatch(/max_n must be a multiple of 8/);
    const ok = load(tree((r) => set(r, 'max_n: 64, max_n_of: "00000000000000aa"'))).model.sidecar;
    expect(ok['fixture-wasm-sort']).toMatchObject({ kernel: 'fixture-wasm-kernel', maxN: 64 });
  });

  describe('options', () => {
    const OPT = '{ name: k, label: "Fan-in k", min: 2, max: 16, step: 1, default: 4 }';
    const set = (r: string, options: string, extra = '') => writeFileSync(join(r, SIDECAR), 'version: 1\n\nentries:\n'
      + `  - { id: fixture-wasm-sort, kernel: fixture-wasm-kernel, engine: array${extra}, options: [${options}] }\n`);
    const errs = (options: string, extra = '') => load(tree((r) => set(r, options, extra))).errors;
    const at = `${SIDECAR}: fixture-wasm-sort -> kernel fixture-wasm-kernel: option`;

    it('ships a valid list with the mapping, in its own order and keys', () => {
      const root = tree((r) => set(r, `${OPT}, { name: memory, label: "Memory M", min: 0, max: 64, step: 4, default: 0, unit: keys }`));
      const { errors, model } = load(root);
      expect(errors).toEqual([]);
      expect(model.sidecar['fixture-wasm-sort']).toEqual({
        sidecar: SIDECAR, adapter: 'sorting-wasm', kernel: 'fixture-wasm-kernel',
        options: [
          { name: 'k', label: 'Fan-in k', min: 2, max: 16, step: 1, default: 4 },
          { name: 'memory', label: 'Memory M', min: 0, max: 64, step: 4, default: 0, unit: 'keys' },
        ],
      });
    });

    it('a name the kernel does not read, naming what it does', () => {
      expect(errs('{ name: base, label: "Base", min: 2, max: 16, step: 1, default: 10 }'))
        .toEqual([`${at} base: the kernel does not read it (its manifest lists k, memory)`]);
    });

    it('a default outside the range, or off its grid', () => {
      expect(errs('{ name: k, label: "k", min: 2, max: 16, step: 1, default: 17 }'))
        .toEqual([`${at} k: default 17 lies outside 2..16`]);
      expect(errs('{ name: k, label: "k", min: 2, max: 16, step: 1, default: 1 }'))
        .toEqual([`${at} k: default 1 lies outside 2..16`]);
      expect(errs('{ name: memory, label: "M", min: 0, max: 64, step: 4, default: 6 }'))
        .toEqual([`${at} memory: default 6 is off the slider's grid (0 + a multiple of 4)`]);
    });

    it('a step that does not divide the range, or an empty range', () => {
      expect(errs('{ name: memory, label: "M", min: 0, max: 62, step: 4, default: 0 }'))
        .toEqual([`${at} memory: step 4 does not divide the range 0..62`]);
      expect(errs('{ name: k, label: "k", min: 4, max: 4, step: 1, default: 4 }'))
        .toEqual([`${at} k: min 4 must be below max 4`]);
      expect(errs('{ name: k, label: "k", min: 2, max: 16, step: 0, default: 4 }'))
        .toEqual([`${at} k: step must be at least 1`]);
    });

    it('a number that is not a whole u32', () => {
      expect(errs('{ name: k, label: "k", min: -1, max: 16, step: 0.5, default: 4 }'))
        .toEqual([`${at} k: min, step must be whole numbers from 0 to 4294967295 (the kernel reads a u32)`]);
    });

    it('an unknown key, a missing label or name, a duplicate, a bad unit, a list that is not one', () => {
      expect(errs('{ name: k, label: "k", min: 2, max: 16, step: 1, default: 4, log: true }'))
        .toEqual([`${at} k: unknown key log; an option has only name, label, min, max, step, default, unit`]);
      expect(errs('{ name: k, min: 2, max: 16, step: 1, default: 4 }')).toEqual([`${at} k: label required`]);
      expect(errs('{ label: "k", min: 2, max: 16, step: 1, default: 4 }')).toEqual([`${at} #1: name required`]);
      expect(errs(`${OPT}, ${OPT}`)).toEqual([`${at} k: declared twice`]);
      expect(errs('{ name: k, label: "k", min: 2, max: 16, step: 1, default: 4, unit: "" }'))
        .toEqual([`${at} k: unit must be a non-empty string`]);
      const root = tree((r) => writeFileSync(join(r, SIDECAR), 'version: 1\n\nentries:\n'
        + '  - { id: fixture-wasm-sort, kernel: fixture-wasm-kernel, engine: array, options: k }\n'));
      expect(load(root).errors).toEqual([`${SIDECAR}: fixture-wasm-sort -> kernel fixture-wasm-kernel: options must be a list`]);
    });

    it('and any wrong option ships none of them', () => {
      const root = tree((r) => set(r, `${OPT}, { name: base, label: "b", min: 2, max: 16, step: 1, default: 10 }`));
      expect(load(root).model.sidecar['fixture-wasm-sort']).not.toHaveProperty('options');
    });

    it('options on a record whose kernel does not play its entry', () => {
      const root = tree((r) => append(r, `  - { id: fixture-kept-sort, kernel: fixture-wasm-kernel, engine: array, existing: true, options: [${OPT}] }`));
      expect(load(root).errors).toContain(`${SIDECAR}: fixture-kept-sort -> kernel fixture-wasm-kernel: `
        + "options on a record whose kernel does not play its entry (existing: its entry's own code plays)");
    });
  });

  it('a record without its id, kernel or engine', () => {
    const root = tree((r) => append(r, '  - { id: fixture-wasm-sort }'));
    expect(load(root).errors).toEqual([`${SIDECAR} record #5: kernel, engine required`]);
  });
});

describe('sidecar fallback: with no sidecar file', () => {
  // the tree as it is without the sorting batch: no sidecar, no adapter
  const bare = (r: string) => {
    rmSync(join(r, SIDECAR));
    rmSync(join(r, 'src/kernels/sorting-wasm'), { recursive: true });
  };

  it('reads no mappings, and judges every entry exactly as before', () => {
    const root = tree(bare);
    const { errors, model } = load(root);
    expect(model.sidecar).toEqual({});
    // the message of a catalogue without sidecars, word for word
    expect(errors).toEqual(['catalogue/entries/fixture-wasm-sort.md: live, but '
      + 'src/kernels/array/fixture-wasm-sort.ts does not exist']);
    expect((discoverCode(root) as { sidecars: unknown[] }).sidecars).toEqual([]);
  });

  it('leaves the registry resolving kernel files only', async () => {
    const root = tree(bare);
    const s = sources(root);
    expect(s.backing).toEqual({});
    expect(await kernelLoader({ id: 'fixture-file-sort', engine: 'array' }, s)())
      .toEqual({ file: 'array/fixture-file-sort' });
    expect(() => kernelLoader({ id: 'fixture-wasm-sort', engine: 'array' }, s))
      .toThrow('fixture-wasm-sort: no src/kernels/array/fixture-wasm-sort.ts');
  });
});
