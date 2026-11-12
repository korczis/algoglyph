// The string engine threads a kernel's own params to its input generator (S2 A0), as the grid
// engine does (src/engines/grid/index.ts optsOf): a control that shapes the input (a pattern's
// length, a text's runs, a regex's nesting) is read by `input(kind, n, shape, seed, opts)`, the
// plate passing the kernel's declared params with their defaults filled in. Checked: the
// generator receives them from the plate, and every string kernel's default input and trace are
// the same whether its defaults are passed explicitly or not at all (rule 10, within one run).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params } from '../src/core/plate';
import { engine } from '../src/engines/string';
import { input, KINDS, type InputKind } from '../src/engines/string/inputs';
import { trace, type StringKernel } from '../src/engines/string/trace';
import { installBrowserStubs, p5Stub } from './support/p5-stub';
import { GROUNDS } from '../src/core/palette';
import { mulberry32 } from '../src/core/random';

installBrowserStubs();

type K = StringKernel<InputKind, unknown>;
const modules = import.meta.glob<K>('../src/kernels/string/[!_]*.ts', { import: 'kernel', eager: true });
const ids = Object.keys(modules).map((p) => p.replace(/^.*\/(.*)\.ts$/, '$1')).sort();
const kernelOf = (id: string) => modules[`../src/kernels/string/${id}.ts`];
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const defaultsOf = (k: K): Params => Object.fromEntries((k.params ?? []).map((d) => [d.key, d.value]));

describe('the string engine threads a kernel\'s params to its input', () => {
  it('the plate hands the generator the kernel\'s params, the defaults filled in', () => {
    const kind: InputKind = 'search';
    const real = KINDS[kind].make;
    const seen: unknown[] = [];
    const kernel: K = {
      input: kind, counters: { compare: 'Comparisons' },
      params: [{ kind: 'range', key: 'probe', label: 'Probe', min: 1, max: 9, step: 1, value: 3, rebuild: true }],
      run: () => null,
    };
    KINDS[kind].make = (rnd, n, shape, opts) => { seen.push(opts); return real(rnd, n, shape, opts); };
    try {
      const code = engine.plate({ id: 'probe', title: 'Probe', group: 'strings/search' }, kernel);
      for (const value of [undefined, 7]) {
        const params: Params = Object.fromEntries(code.params.map((d) => [d.key, d.value]));
        if (value !== undefined) params.probe = value;
        const ground = GROUNDS.dark;
        code.create(p5Stub(), {
          width: 400, height: 300, params, seed: 1, rnd: mulberry32(1), theme: 'dark', bg: ground.bg,
          fg: ground.fg, thumbnail: false, palette: () => [], stats() {}, chart() {},
        } as never);
      }
    } finally {
      KINDS[kind].make = real;
    }
    expect(seen).toEqual([{ probe: 3 }, { probe: 7 }]);
  });

  it('every string kernel draws the same input and records the same trace with its defaults passed', () => {
    const live = new Set(ENTRIES.filter((e) => e.engine === 'string').map((e) => e.id));
    expect(ids.filter((id) => live.has(id)).length, 'the live string kernels are covered').toBeGreaterThan(0);
    for (const id of ids) {
      const k = kernelOf(id);
      const def = KINDS[k.input];
      const shapes = def.shapes.length ? def.shapes.map((s) => s.value) : [''];
      const p = defaultsOf(k);
      for (const shape of shapes) {
        for (const n of [...new Set([def.size.min, def.size.value, def.size.max])]) {
          for (const seed of [1, 4242]) {
            const plain = input(k.input, n, shape, seed);
            const given = input(k.input, n, shape, seed, p);
            expect(hash(given), `${id} ${shape} n=${n} seed=${seed}: input`).toBe(hash(plain));
            const a = trace(k, plain as never, p);
            const b = trace(k, given as never, p);
            expect(hash(b.events.toArray()), `${id} ${shape} n=${n} seed=${seed}: trace`).toBe(hash(a.events.toArray()));
            expect(b.counts, `${id} ${shape} n=${n} seed=${seed}: counts`).toEqual(a.counts);
          }
        }
      }
    }
  }, 120_000);
});
