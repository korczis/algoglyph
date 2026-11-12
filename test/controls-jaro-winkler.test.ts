// Winkler's prefix scale and boost threshold become controls (S2 B2). The bonus was
// 0.1 × ℓ × (1 − Jaro) for the shared prefix ℓ ≤ 4, added when Jaro exceeds 0.7; now the scale
// is the control p (default 0.1) and the threshold the control boost (default 0.7), passed to
// jaroWinklerSteps in src/kernels/string/_normalise.ts. Checked: both controls exist, they
// travel in a shared link, they drive the readouts (JW = Jaro + ℓ p (1 − Jaro) above the
// threshold and Jaro below it, so Jaro ≤ JW ≤ 1 while p ≤ 1/4, and JW = Jaro exactly at p = 0 or
// boost = 1), and the kernel and every other user of _normalise trace what they did before.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS, type InputKind } from '../src/engines/string/inputs';
import { trace, type StringKernel } from '../src/engines/string/trace';
import { jaroWinkler, jaroWinklerSteps } from '../src/kernels/string/_normalise';
import { kernel } from '../src/kernels/string/jaro-winkler';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

type K = StringKernel<InputKind, unknown>;
const modules = import.meta.glob<K>('../src/kernels/string/[!_]*.ts', { import: 'kernel', eager: true });
const ID = 'jaro-winkler';
/** The claims' seed (src/core/claims.ts DEFAULT_SEED) and the plate's default input. */
const SEED = 4242;
const N = KINDS.pair.size.value;
const SHAPES = KINDS.pair.shapes.map((s) => s.value);

const entry = ENTRIES.find((e) => e.id === ID)!;
const plate = () => engine.plate({ id: ID, title: entry.title, group: entry.taxonomy }, kernel);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, number> } });
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => Number((d.min + i * d.step).toFixed(10)));
const defOf = (key: string) => plate().params.find((x) => x.key === key) as RangeParam | undefined;

/** Jaro similarity, written here from its definition (never imported from the code under test). */
function jaroRef(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  const win = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const used = new Array<boolean>(b.length).fill(false);
  const ma: string[] = [];
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - win); j <= Math.min(b.length - 1, i + win); j++) {
      if (!used[j] && a[i] === b[j]) { used[j] = true; ma.push(a[i]); break; }
    }
  }
  const mb = [...b].filter((_, j) => used[j]);
  const m = ma.length;
  if (!m) return 0;
  const t = ma.filter((c, k) => c !== mb[k]).length / 2;
  return (m / a.length + m / b.length + (m - t) / m) / 3;
}
const prefixOf = (a: string, b: string) => { let l = 0; while (l < 4 && l < a.length && l < b.length && a[l] === b[l]) l++; return l; };
const pairs = () => SHAPES.flatMap((shape) => [4, N, 48].flatMap((n) => [1, 2, 3, 5, 8, SEED].map((seed) => input('pair', n, shape, seed))));

describe('jaro-winkler: prefix scale', () => {
  it('is a range control with the old constant 0.1 as its default', () => {
    expect(defOf('p')).toMatchObject({ kind: 'range', label: 'Prefix scale', min: 0, max: 0.25, step: 0.01, value: 0.1, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const p of [0, 0.05, 0.25]) expect(parse(defs, serialise(defs, { ...d, p }, 7)), `${p}`).toEqual({ seed: 7, params: { p } });
  });

  it('adds ℓ p (1 − Jaro) above the threshold, and keeps Jaro ≤ JW ≤ 1, at every setting', () => {
    const d = defOf('p');
    expect(d, 'the plate declares the control').toBeDefined();
    for (const p of settings(d!)) {
      for (const x of pairs()) {
        const r = trace(kernel, x, { p }).result as { jaro: number; jw: number };
        const jaro = jaroRef(x.a, x.b);
        expect(r.jaro).toBeCloseTo(jaro, 12);
        const want = jaro > 0.7 ? jaro + prefixOf(x.a, x.b) * p * (1 - jaro) : jaro;
        expect(r.jw, `p=${p} ${x.a} / ${x.b}`).toBeCloseTo(want, 12);
        expect(r.jw).toBeGreaterThanOrEqual(r.jaro);
        expect(r.jw).toBeLessThanOrEqual(1);
        if (p === 0) expect(r.jw).toBe(r.jaro);
      }
    }
  });

  it('drives the plate\'s readouts', async () => {
    const x = input('pair', N, SHAPES[0], SEED);
    const jaro = jaroRef(x.a, x.b);
    for (const p of [0, 0.2, 0.25]) {
      const jw = await read(ID, claim('Jaro–Winkler', { p }));
      expect(jw.reason).toBeUndefined();
      const want = jaro > 0.7 ? jaro + prefixOf(x.a, x.b) * p * (1 - jaro) : jaro;
      expect(jw.text, `p=${p}`).toBe(want.toFixed(4));
    }
  });
});

describe('jaro-winkler: boost threshold', () => {
  it('is a range control with the old constant 0.7 as its default', () => {
    expect(defOf('boost')).toMatchObject({ kind: 'range', label: 'Boost above', min: 0, max: 1, step: 0.05, value: 0.7, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const boost of [0, 0.85, 1]) expect(parse(defs, serialise(defs, { ...d, boost }, 7)), `${boost}`).toEqual({ seed: 7, params: { boost } });
  });

  it('adds the bonus only above the threshold, none at all at boost = 1', () => {
    const d = defOf('boost');
    expect(d, 'the plate declares the control').toBeDefined();
    for (const boost of settings(d!)) {
      for (const x of pairs()) {
        const r = trace(kernel, x, { boost }).result as { jaro: number; jw: number };
        const want = r.jaro > boost ? r.jaro + prefixOf(x.a, x.b) * 0.1 * (1 - r.jaro) : r.jaro;
        expect(r.jw, `boost=${boost} ${x.a} / ${x.b}`).toBe(want);
        if (boost === 1) expect(r.jw).toBe(r.jaro);
      }
    }
  });

  it('drives the plate\'s readouts', async () => {
    const x = input('pair', N, SHAPES[0], SEED);
    const jaro = jaroRef(x.a, x.b);
    const jw = await read(ID, claim('Jaro–Winkler', { boost: 1 }));
    expect(jw.reason).toBeUndefined();
    expect(jw.text).toBe(jaro.toFixed(4));
    const at0 = await read(ID, claim('Jaro–Winkler', { boost: 0 }));
    expect(at0.text).toBe((jaro + prefixOf(x.a, x.b) * 0.1 * (1 - jaro)).toFixed(4));
  });
});

describe('jaro-winkler and the other users of _normalise at their defaults are what they were', () => {
  // recorded on the code before the controls existed (779097a): every event and count
  const JW = '422d962bab444203';
  // the other kernels that import _normalise: integer columns and strings. fellegi-sunter (it
  // imports foldMarks alone) is left to its own file: its EM stops on a log-likelihood, a log
  const USERS = '5a9059e682641a29';
  const others = ['blocking-sorted-neighbourhood', 'double-metaphone', 'minhash-lsh', 'name-normalisation',
    'simhash', 'source-family'];

  it('the kernel records the same trace, with the defaults passed or absent', () => {
    const runs = (extra: Params) => pairs().map((x) => {
      const t = trace(kernel, x, extra);
      return [t.counts, hash(t.events.toArray())];
    });
    const absent = runs({});
    expect(hash(absent)).toBe(JW);
    expect(runs({ p: 0.1, boost: 0.7 })).toEqual(absent);
  });

  it('jaroWinkler with the defaults passed equals it without them', () => {
    for (const x of pairs()) {
      const eq = (i: number, j: number) => x.a[i] === x.b[j];
      const absent = jaroWinkler(x.a, x.b);
      expect(jaroWinkler(x.a, x.b, eq, { scale: 0.1, boost: 0.7 })).toEqual(absent);
      const steps = jaroWinklerSteps(x.a, x.b, eq, { scale: 0.1, boost: 0.7 });
      let r = steps.next();
      while (!r.done) r = steps.next();
      expect(r.value).toEqual(absent);
    }
  });

  it('every other kernel that imports _normalise records the same trace', () => {
    const all = others.map((id) => {
      const k = modules[`../src/kernels/string/${id}.ts`];
      const def = KINDS[k.input];
      return (def.shapes.length ? def.shapes.map((s) => s.value) : ['']).flatMap((shape) => [def.size.min, def.size.value]
        .flatMap((n) => [1, SEED].map((seed) => {
          const t = trace(k, input(k.input, n, shape, seed) as never, {});
          return [id, shape, n, seed, t.counts, hash(t.events.toArray().map((e) => [e.o, e.p, e.i, e.j, e.s, e.ss]))];
        })));
    });
    expect(hash(all)).toBe(USERS);
  }, 120_000);
});
