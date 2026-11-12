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
import { EVENT_CAP, input, SHAPES, type KernelOption } from '../src/engines/array/trace';
import { loadSorting, SOP, STRIDE, type WasmRun } from '../src/kernels/sorting-wasm/_abi';
import {
  optionWords, seedOf, sidecarKernel, traceCache, traceKey, traceOf, wasmKernel,
} from '../src/kernels/sorting-wasm/_adapter';
import { kernelOf, optionsOf } from '../src/kernels/sorting-wasm/_sidecar';
import { corners } from './support/budget';
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

  it("puts every option at both ends of its slider, at the largest input, among the budget gate's corners", async () => {
    // the gate (test/support/budget.ts) derives its heavy corners from the plate's own controls,
    // so each option is measured at its extremes with no subject listed by hand (npm run test:budget)
    for (const t of TUNED) {
      const plate = (await loadPlate(t.id))!;
      const nMax = (plate.params.find((d) => d.key === 'n') as { max: number }).max;
      const cs = corners(plate.params);
      for (const o of t.options) {
        for (const end of [o.min, o.max]) {
          expect(cs.some((c) => c[o.name] === end && c.n === nMax), `${t.id}: ${o.name} = ${end}`).toBe(true);
        }
      }
    }
  });

  it('refuses an option that would shadow a control of the plate', () => {
    const k = { run() {}, options: [{ name: 'n', label: 'N', min: 1, max: 2, step: 1, default: 1 }] };
    expect(() => optionParams(k, ['shape', 'n'])).toThrow('array engine: option n is already a control of the plate');
    expect(optionValues(k, {})).toEqual({ n: 1 });
    expect(optionValues(k, { n: 2 })).toEqual({ n: 2 });
  });
});

// ---------------------------------------------------------------------------------------------
// The laws. Each option a sidecar record declares has one here, keyed `<kernel>:<option>`, and
// is asserted at every value of its slider (the other options at their defaults unless the law
// varies them together). The expected values are computed from the algorithm's definition, by
// integer arithmetic, never from the kernel's output.

/** The smallest p with base^p >= x: ceil(log_base x), by multiplication. */
function ceilLog(base: number, x: number): number {
  let p = 0;
  for (let reach = 1; reach < x; reach *= base) p++;
  return p;
}
/** Digits of `range` in base b: the smallest d >= 1 with b^d > range (an LSD sort's passes). */
const digits = (b: number, range: number) => Math.max(1, ceilLog(b, range + 1));
/** The default memory of the external sorts: ceil(sqrt n), at least 4. */
function autoMemory(n: number): number {
  let m = 4;
  while (m * m < n) m++;
  return m;
}
/** Distinct lanes of a run, from its own lane words. */
function lanes(r: WasmRun): number {
  const seen = new Set<number>();
  for (let e = 0; e < r.steps.length; e += STRIDE) if ((r.steps[e] & 15) === SOP.lane) seen.add(r.steps[e + 1]);
  return seen.size;
}
/** The labels of a run's range marks, in order. */
function markLabels(r: WasmRun): string[] {
  const out: string[] = [];
  for (let e = 0; e < r.steps.length; e += STRIDE) if ((r.steps[e] & 15) === SOP.mark) out.push(r.strings[r.steps[e + 2]] ?? '');
  return out;
}
/** A permutation of 1..n (its key range is n - 1). */
const perm = (n: number) => input('random', n, 3 * n + 1);
const run = (kernel: string, keys: number[], options: Record<string, number>) => {
  const r = S.run(kernel, keys, { seed: seedOf(keys), options, maxSteps: EVENT_CAP });
  expect(r.outcome, `${kernel} ${JSON.stringify(options)}`).toBe('sorted');
  return r;
};
const valuesOf = (kernel: string, name: string) => {
  const o = TUNED.find((t) => t.kernel === kernel)!.options.find((x) => x.name === name)!;
  return grid(o);
};

type Law = (kernel: string) => void;
const lanesAreP: Law = (kernel) => {
  for (const n of [128, 512]) {
    for (const p of valuesOf(kernel, 'k')) expect(lanes(run(kernel, perm(n), { k: p })), `${kernel} n ${n} p ${p}`).toBe(p);
  }
};
const LAWS: Record<string, { law: string; check: Law }> = {
  'external-merge-sort:k': {
    law: 'passes = 1 + ceil(log_k ceil(n / M)), across k (and M)',
    check: (kernel) => {
      for (const n of [64, 200, 512]) {
        for (const k of valuesOf(kernel, 'k')) {
          for (const m of valuesOf(kernel, 'memory')) {
            const runs = Math.ceil(n / (m || autoMemory(n)));
            expect(run(kernel, perm(n), { k, memory: m }).counts.rounds, `n ${n} k ${k} M ${m}`).toBe(1 + ceilLog(k, runs));
          }
        }
      }
    },
  },
  'external-merge-sort:memory': {
    law: 'passes = 1 + ceil(log_k ceil(n / M)), across M (and k): fall as M grows',
    check: (kernel) => {
      const at = (m: number) => run(kernel, perm(512), { k: 2, memory: m }).counts.rounds;
      expect(valuesOf(kernel, 'memory').filter((m) => m).map(at))
        .toEqual(valuesOf(kernel, 'memory').filter((m) => m).map((m) => 1 + ceilLog(2, Math.ceil(512 / m))));
      expect([at(4), at(16), at(64)]).toEqual([8, 6, 4]);
      expect(at(0)).toBe(1 + ceilLog(2, Math.ceil(512 / 23)));
    },
  },
  'tape-merge-sort:memory': {
    law: 'passes = 1 + 2 ceil(log_2 ceil(n / M)) across M',
    check: (kernel) => {
      for (const n of [64, 200, 512]) {
        for (const m of valuesOf(kernel, 'memory')) {
          const runs = Math.ceil(n / (m || autoMemory(n)));
          expect(run(kernel, perm(n), { memory: m }).counts.rounds, `n ${n} M ${m}`).toBe(1 + 2 * ceilLog(2, runs));
        }
      }
    },
  },
  'k-way-merge-sort:k': {
    law: 'merges = (n - 1) / (k - 1) at n = k^j, and one per range of two or more keys of its k-way split',
    check: (kernel) => {
      const merges = (r: WasmRun) => markLabels(r).filter((l) => /^\d+-way merge$/.test(l));
      for (const k of valuesOf(kernel, 'k')) {
        for (let n = k; n <= 512; n *= k) expect(merges(run(kernel, perm(n), { k })).length, `k ${k} n ${n}`).toBe((n - 1) / (k - 1));
        // any n: one merge per range of at least two keys, a range of m split into min(k, m) parts
        const count = (m: number): number => {
          if (m < 2) return 0;
          const parts = Math.min(k, m);
          let c = 1;
          for (let p = 0; p < parts; p++) c += count(Math.floor(((p + 1) * m) / parts) - Math.floor((p * m) / parts));
          return c;
        };
        for (const n of [100, 333, 512]) {
          const ms = merges(run(kernel, perm(n), { k }));
          expect(ms.length, `k ${k} n ${n}`).toBe(count(n));
          expect(ms.at(-1), `k ${k} n ${n}: the last merge is the top one`).toBe(`${Math.min(k, n)}-way merge`);
        }
      }
    },
  },
  'd-ary-heapsort:k': {
    law: 'on equal keys a sift stops after one look at its children: (n - 1) + sum min(d, e - 1) comparisons',
    check: (kernel) => {
      for (const n of [2, 17, 100, 512]) {
        const keys = new Array<number>(n).fill(7);
        for (const d of valuesOf(kernel, 'k')) {
          let extract = 0;
          for (let e = 2; e <= n - 1; e++) extract += Math.min(d, e - 1);
          expect(run(kernel, keys, { k: d }).counts.cmp, `n ${n} d ${d}`).toBe(n - 1 + extract);
        }
      }
      // and no sift climbs more levels than the heap is deep: depth(end - 1) for a heap of `end`
      const keys = perm(512);
      for (const d of valuesOf(kernel, 'k')) {
        const depth = (i: number): number => (i === 0 ? 0 : 1 + depth(Math.floor((i - 1) / d)));
        const r = run(kernel, keys, { k: d });
        let end = 512;
        let swaps = -1; // the swap that moves the maximum out is not a level of the sift
        let inExtract = false;
        for (let e = 0; e < r.steps.length; e += STRIDE) {
          const op = r.steps[e] & 15;
          if (op === SOP.phase) inExtract = r.strings[r.steps[e] >>> 8] === 'extract maxima';
          if (!inExtract) continue;
          if (op === SOP.swap) swaps++;
          if (op === SOP.mark) {
            end--;
            expect(swaps, `d ${d}: sift of a heap of ${end}`).toBeLessThanOrEqual(depth(Math.max(0, end - 1)));
            swaps = -1;
          }
        }
        expect(end, `d ${d}: one sift per extraction`).toBe(1);
      }
    },
  },
  'psrs:k': { law: 'lanes = p', check: lanesAreP },
  'parallel-samplesort:k': { law: 'lanes = p', check: lanesAreP },
  'parallel-counting-sort:k': { law: 'lanes = p', check: lanesAreP },
  'ps4o:k': { law: 'lanes = p', check: lanesAreP },
  'terasort:k': { law: 'lanes = p', check: lanesAreP },
  'mapreduce-sort:k': { law: 'lanes = p', check: lanesAreP },
  'parallel-merge-sort:k': {
    law: 'one lane per non-empty block of ceil(n / p) keys, B = ceil(n / ceil(n / p)) (p when every block has keys), '
      + 'and rounds = 1 + ceil(log_2 B): a local sort, then pairwise merges',
    check: (kernel) => {
      for (const n of [128, 512]) {
        for (const p of valuesOf(kernel, 'k')) {
          const blocks = Math.ceil(n / Math.ceil(n / p));
          const r = run(kernel, perm(n), { k: p });
          expect([lanes(r), r.counts.rounds], `n ${n} p ${p}`).toEqual([blocks, 1 + ceilLog(2, blocks)]);
        }
      }
      // at n = 512 every block of every p on the slider has keys: lanes = p exactly
      for (const p of valuesOf(kernel, 'k')) expect(lanes(run(kernel, perm(512), { k: p })), `p ${p}`).toBe(p);
    },
  },
  'parallel-radix-sort:k': { law: 'lanes = p', check: lanesAreP },
  'parallel-radix-sort:base': {
    law: 'two rounds and n writes per digit: rounds = 2 d, writes = d n, d = digits of the key range in base b',
    check: (kernel) => {
      for (const n of [128, 512]) {
        for (const b of valuesOf(kernel, 'base')) {
          const r = run(kernel, perm(n), { base: b });
          const d = digits(b, n - 1);
          expect([r.counts.rounds, r.counts.write], `n ${n} b ${b}`).toEqual([2 * d, d * n]);
        }
      }
    },
  },
  'external-radix-sort:base': {
    law: 'one pass and n writes per digit: passes = d, writes = d n, d = digits of the key range in base b',
    check: (kernel) => {
      for (const n of [128, 512]) {
        for (const b of valuesOf(kernel, 'base')) {
          const r = run(kernel, perm(n), { base: b });
          const d = digits(b, n - 1);
          expect([r.counts.rounds, r.counts.write], `n ${n} b ${b}`).toEqual([d, d * n]);
        }
      }
    },
  },
};

describe('sorting options: the counted law of each, across its range', () => {
  it('every option a sidecar declares has its law here, and every law an option', () => {
    const declared = TUNED.flatMap((t) => t.options.map((o) => `${t.kernel}:${o.name}`)).sort();
    expect(Object.keys(LAWS).sort()).toEqual(declared);
  });
  for (const [key, { law, check }] of Object.entries(LAWS)) {
    it(`${key}: ${law}`, () => check(key.split(':')[0]));
  }
});
