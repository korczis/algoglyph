// The tunable constants of the wasm sorting kernels (catalogue/sorting-sidecar.yaml `options`),
// as the adapter (src/kernels/sorting-wasm/) sends them and the module runs them. Every case is
// generated from the sidecar: an option a record declares is tested here without a line of code
// naming its kernel. What each option does to the counted run, the law of its algorithm, is
// asserted per law below, across the option's whole range.
import { describe, expect, it } from 'vitest';
import { CATALOGUE, ENTRIES } from '../src/core/catalogue';
import { PACING } from '../src/core/pace';
import { GROUNDS, palette as lookupPalette } from '../src/core/palette';
import { defaults as defaultsOf, type Params, type PlateContext, type Stat } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import { optionParams, optionValues } from '../src/engines/array';
import { loadPlate } from '../src/registry';
import { input, SHAPES, type KernelOption } from '../src/engines/array/trace';
import { loadSorting, type WasmRun } from '../src/kernels/sorting-wasm/_abi';
import {
  optionWords, seedOf, sidecarKernel, traceCache, traceKey, traceOf, wasmKernel,
} from '../src/kernels/sorting-wasm/_adapter';
import { kernelOf, optionsOf } from '../src/kernels/sorting-wasm/_sidecar';
import { installBrowserStubs, p5Stub } from './support/p5-stub';

installBrowserStubs();

const S = await loadSorting();
/** Every entry whose sidecar record declares options, with its kernel and the options. */
const TUNED = Object.keys(CATALOGUE.sidecar ?? {})
  .filter((id) => optionsOf(id)?.length)
  .map((id) => ({ id, kernel: kernelOf(id)!, options: optionsOf(id)! }));
const defaults = (options: readonly KernelOption[]) => Object.fromEntries(options.map((o) => [o.name, o.default]));
/** Every value an option's slider offers. */
const grid = (o: KernelOption) => Array.from({ length: (o.max - o.min) / o.step + 1 }, (_, i) => o.min + i * o.step);
const same = (a: WasmRun, b: WasmRun) => {
  expect(a.counts).toEqual(b.counts);
  expect(a.output).toEqual(b.output);
  expect(a.steps).toEqual(b.steps);
  expect(a.strings).toEqual(b.strings);
};

describe('sorting options: the adapter', () => {
  it('has kernels to tune, each a live array entry', () => {
    expect(TUNED.length).toBeGreaterThan(0);
    for (const t of TUNED) expect(ENTRIES.find((e) => e.id === t.id), t.id).toMatchObject({ status: 'live', engine: 'array' });
  });

  it('offers only options the module says the kernel reads', () => {
    for (const t of TUNED) {
      for (const o of t.options) expect(S.meta(t.kernel)!.options, `${t.id}: ${o.name}`).toContain(o.name);
    }
    const t = TUNED[0];
    const foreign = S.options.find((o) => !S.meta(t.kernel)!.options.includes(o))!;
    expect(() => wasmKernel(S, t.kernel, undefined, [{ ...t.options[0], name: foreign }]))
      .toThrow(`sorting-wasm: ${t.kernel} does not read ${foreign}`);
    expect(() => S.run(t.kernel, [3, 1, 2], { options: { [foreign]: 2 } })).toThrow(/does not read an option/);
    expect(() => S.run(t.kernel, [3, 1, 2], { options: { [t.options[0].name]: 1.5 } })).toThrow(/not a whole u32/);
  });

  it("at every option's default, runs exactly what the kernel runs with no option set", () => {
    // the sidecar default is the kernel's own constant: the plate's default run is the old one
    for (const t of TUNED) {
      for (const shape of SHAPES) {
        for (const n of [2, 33, 200, 512]) {
          const keys = input(shape, n, 900 + n);
          same(S.run(t.kernel, keys, { seed: seedOf(keys), options: defaults(t.options) }),
            S.run(t.kernel, keys, { seed: seedOf(keys) }));
        }
      }
    }
  });

  it('sends each option snapped onto its slider, and its default when the plate gives none', () => {
    const o: KernelOption = { name: 'memory', label: 'M', min: 0, max: 64, step: 4, default: 0 };
    expect(optionWords([o])).toEqual({ memory: 0 });
    expect(optionWords([o], { memory: 13 })).toEqual({ memory: 12 });
    expect(optionWords([o], { memory: 1000 })).toEqual({ memory: 64 });
    expect(optionWords([o], { memory: -5 })).toEqual({ memory: 0 });
    expect(optionWords([o], { memory: Number.NaN })).toEqual({ memory: 0 });
    expect(() => optionWords([o], { k: 2 })).toThrow('sorting-wasm: no option k');
  });

  it('re-traces when an option changes, and recalls the run when it does not', async () => {
    for (const t of TUNED) {
      const k = await sidecarKernel(t.id);
      expect(k.options, t.id).toEqual(t.options);
      const keys = new Int32Array(input('random', 256, 5));
      const o = t.options[0];
      const other = o.default === o.max ? o.min : o.max;
      const a = traceOf(S, t.kernel, keys, optionWords(t.options));
      expect(traceOf(S, t.kernel, keys, optionWords(t.options))).toBe(a);
      const b = traceOf(S, t.kernel, keys, optionWords(t.options, { [o.name]: other }));
      expect(b, `${t.id}: ${o.name} ${o.default} -> ${other}`).not.toBe(a);
      expect(traceKey(t.kernel, keys, { options: { [o.name]: other } }))
        .not.toBe(traceKey(t.kernel, keys, { options: { [o.name]: o.default || other + o.step } }));
      // the recorded run differs (a parallel kernel's p may move only its lanes, never its work)
      expect(b.steps, `${t.id}: ${o.name} changes the recorded run`).not.toEqual(a.steps);
    }
    expect(traceCache(S).stats().values).toBeGreaterThan(0);
  });

  it('every value of every slider gives a sorted run within the step limit at the largest n', () => {
    for (const t of TUNED) {
      const keys = input('random', 512, 41);
      for (const o of t.options) {
        for (const v of grid(o)) {
          const r = S.run(t.kernel, keys, { seed: seedOf(keys), options: { ...defaults(t.options), [o.name]: v }, trace: false });
          expect(r.outcome, `${t.id} ${o.name}=${v}`).toBe('sorted');
          expect(Array.from(r.output), `${t.id} ${o.name}=${v}`).toEqual([...keys].sort((x, y) => x - y));
        }
      }
    }
  });
});

describe('sorting options: the plate', () => {
  /** A tuned entry's plate, its params at their defaults with `set` over them, run to its end. */
  async function ran(id: string, set: Params): Promise<Stat[]> {
    const plate = (await loadPlate(id))!;
    const params: Params = { ...defaultsOf(plate), n: 128, pace: PACING.pace.max, loop: false, ...set };
    let rows: Stat[] = [];
    const ctx: PlateContext = {
      width: 1440, height: 810, params, seed: 77, rnd: mulberry32(77), theme: 'dark', bg: GROUNDS.dark.bg,
      fg: GROUNDS.dark.fg, thumbnail: false, palette: () => lookupPalette('spectral'),
      stats(r) { rows = r; }, chart() {},
    };
    const sim = plate.create(p5Stub(), ctx);
    sim.setup();
    for (let f = 0; f < 20000 && !rows.some((r) => r.label === 'Result'); f++) sim.draw();
    return rows;
  }
  const row = (rows: Stat[], label: string) => rows.find((r) => r.label === label)?.value;

  it('offers every option as a slider of its own, before the pace, at the kernel default', async () => {
    for (const t of TUNED) {
      const plate = (await loadPlate(t.id))!;
      const keys = plate.params.map((d) => d.key);
      for (const o of t.options) {
        const d = plate.params.find((p) => p.key === o.name);
        expect(d, `${t.id}: ${o.name}`).toMatchObject({ kind: 'range', min: o.min, max: o.max, step: o.step,
          value: o.default, rebuild: true });
        expect(d!.label.startsWith(o.label), `${t.id}: ${o.name} label`).toBe(true);
        expect(keys.indexOf(o.name), `${t.id}: ${o.name} before the pace`).toBeLessThan(keys.indexOf('pace'));
      }
    }
  });

  it('round-trips every value of every option through a shared link', async () => {
    for (const t of TUNED) {
      const plate = (await loadPlate(t.id))!;
      const d = defaultsOf(plate);
      for (const o of t.options) {
        for (const v of grid(o)) {
          const want = { ...d, [o.name]: v };
          const query = serialise(plate.params, want, 5);
          expect(query.includes(`${o.name}=`), `${t.id}: ${o.name}=${v} in ${query}`).toBe(v !== o.default);
          expect({ ...d, ...parse(plate.params, query).params }, `${t.id}: ${o.name}=${v}`).toEqual(want);
        }
        // a link off the grid or outside the range opens on the slider, never past it
        expect(parse(plate.params, `seed=5&${o.name}=${o.max + 10 * o.step}`).params[o.name]).toBe(o.max);
        expect(parse(plate.params, `seed=5&${o.name}=x`).params).toEqual({});
      }
    }
  });

  it('runs the plate with the option the controls hold', async () => {
    for (const t of TUNED) {
      const o = t.options[0];
      const other = o.default === o.min ? o.max : o.min;
      const [a, b] = [await ran(t.id, {}), await ran(t.id, { [o.name]: other })];
      expect(row(a, 'Result'), t.id).toBe('ascending, verified');
      expect(row(b, 'Result'), t.id).toBe('ascending, verified');
      expect(row(b, 'Progress'), `${t.id}: ${o.name} ${o.default} -> ${other}`).not.toBe(row(a, 'Progress'));
    }
  });

  it('refuses an option that would shadow a control of the plate', () => {
    const k = { run() {}, options: [{ name: 'n', label: 'N', min: 1, max: 2, step: 1, default: 1 }] };
    expect(() => optionParams(k, ['shape', 'n'])).toThrow('array engine: option n is already a control of the plate');
    expect(optionValues(k, {})).toEqual({ n: 1 });
    expect(optionValues(k, { n: 2 })).toEqual({ n: 2 });
  });
});
