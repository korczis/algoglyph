// mc-verdict-stability's least item reliability becomes a control (S4 C2): the evidence set drew
// each item's reliability as 0.55 + 0.4 · u; it now draws min(1, minRel + 0.4 · u), the same draw
// in the same place, so the default 0.55 is the old set (0.55 + 0.4 · u < 1, the cap never
// bites). Checked: the control exists with the old constant as its default, it travels in a
// shared link, it drives what the plate reads (at minRel 1 every item holds in every run, so with
// no strength noise the verdict never flips and stability is 100%; at noise 0 the plate also
// shows the exact stability, enumerated over which of the k ≤ 12 items hold, and the sampled
// one stays within its binomial error of it), and the run at the defaults is what it was.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Params, RangeParam } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import { Sampler } from '../src/engines/stochastic/sample';
import { evidenceSet } from '../src/engines/stochastic/scenarios';
import { trace } from '../src/engines/stochastic/trace';
import { kernel, type VerdictResult } from '../src/kernels/stochastic/mc-verdict-stability';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'mc-verdict-stability';
const KEY = 'minRel';
const EXACT = 'Exact stability (no strength noise)';
const SEEDS = [1, 7, 4242];

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const settings = (d: RangeParam) =>
  Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => +(d.min + i * d.step).toFixed(10));
const defOf = () => kernel.params?.find((d) => d.key === KEY) as RangeParam | undefined;
const claim = (readout: string, params: Params, expect: Claim['expect'] = { range: [-1e12, 1e12] }): Claim =>
  ({ id: 'probe', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });
const items = (seed: number, k: number, minRel?: number) =>
  (evidenceSet as (s: Sampler, k: number, m?: number) => ReturnType<typeof evidenceSet>)(new Sampler(mulberry32(seed)), k, minRel);
const run = (p: Params, seed: number) => trace(kernel, p, seed);

/** The stability with no strength noise, by enumerating which items hold up. */
function exact(r: VerdictResult): number {
  let out = 0;
  for (let S = 0; S < 1 << r.items.length; S++) {
    let p = 1;
    let lo = r.prior;
    r.items.forEach((e, i) => {
      if (S & (1 << i)) { p *= e.reliability; lo += e.llr; } else p *= 1 - e.reliability;
    });
    if (lo > 0 === r.baseline) out += p;
  }
  return out;
}

describe('mc-verdict-stability: least item reliability', () => {
  it('is a range control with the old constant as its default', () => {
    expect(defOf()).toMatchObject({ kind: 'range', label: 'Least item reliability', min: 0.05, max: 1, step: 0.05, value: 0.55, rebuild: true });
  });

  it('round-trips through a shared link', async () => {
    const defs = (await loadPlate(ID))!.params;
    expect(defs.find((d) => d.key === KEY)).toEqual(defOf());
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [0.05, 0.3, 0.8, 1]) {
      expect(parse(defs, serialise(defs, { ...d, [KEY]: v }, 7))).toEqual({ seed: 7, params: { [KEY]: v } });
    }
  });

  it('draws reliabilities in [minRel, min(1, minRel + 0.4)] with the same draws at every setting', () => {
    expect(defOf(), 'the kernel declares the control').toBeDefined();
    for (const m of settings(defOf()!)) {
      for (const seed of SEEDS) {
        for (const k of [2, 7, 12]) {
          const a = items(seed, k, m);
          const base = items(seed, k);
          a.forEach((e, i) => {
            expect(e.reliability).toBeGreaterThanOrEqual(m);
            expect(e.reliability).toBeLessThanOrEqual(Math.min(1, m + 0.4));
            expect({ ...e, reliability: 0 }).toEqual({ ...base[i], reliability: 0 });
          });
        }
      }
    }
  });

  it('at minRel 1 and noise 0 every item holds, so the verdict never flips', () => {
    for (const seed of SEEDS) {
      const r = run({ [KEY]: 1, noise: 0, n: 2000 }, seed).result;
      expect(r.items.every((e) => e.reliability === 1)).toBe(true);
      expect(r.stability).toBe(1);
    }
  });

  it('drives the readouts: 100% at minRel 1, the exact enumeration within 4 SE elsewhere', async () => {
    const top = await read(ID, claim('Stability', { [KEY]: 1, noise: 0 }));
    expect(top.reason).toBeUndefined();
    expect(top.value).toBe(100);
    const ex = await read(ID, claim(EXACT, { [KEY]: 1, noise: 0 }));
    expect(ex.reason).toBeUndefined();
    expect(ex.value).toBe(100);
    for (const m of [0.05, 0.3, 0.55, 0.8]) {
      const d = await read(ID, claim('Stability', { [KEY]: m, noise: 0 }, { against: EXACT, tolerance: 3 }));
      expect(d.reason, `minRel ${m}`).toBeUndefined();
      expect(Math.abs(d.value!), `minRel ${m}: ${d.text}`).toBeLessThanOrEqual(3);
    }
    // the exact readout is the enumeration
    for (const seed of SEEDS) {
      const t = run({ [KEY]: 0.3, noise: 0, n: 2000 }, seed);
      const row = t.frames.at(-1)!.stats.find((s) => s.label === EXACT);
      expect(row?.value).toBe(`${(100 * exact(t.result)).toFixed(1)}%`);
    }
  });
});

describe('mc-verdict-stability at the defaults is what it was before the control', () => {
  // arithmetic on uniform draws only (no log, sin or cos), recorded on the code before the
  // control existed (5f091c7); the noisy run is compared within this run instead
  const ITEMS = '1f8d65395847db11';
  const NOISELESS = 'fabae360d077fc87';

  it('draws the same evidence sets', () => {
    const all = SEEDS.flatMap((seed) => [2, 7, 12].map((k) => items(seed, k)));
    expect(hash(all)).toBe(ITEMS);
    for (const seed of SEEDS) expect(items(seed, 7, 0.55)).toEqual(items(seed, 7));
  });

  it('runs the same with no strength noise, the old readouts kept', () => {
    const out = SEEDS.map((seed) => {
      const t = run({ noise: 0 }, seed);
      return [t.result.stability, t.draws, t.frames.length,
        t.frames.at(-1)!.stats.filter((s) => s.label !== EXACT)];
    });
    expect(hash(out), JSON.stringify(out[0])).toBe(NOISELESS);
  });

  it('runs the same at the defaults with the default passed explicitly, and shows no exact row', () => {
    for (const seed of SEEDS) {
      const a = run({}, seed);
      const b = run({ [KEY]: 0.55 }, seed);
      expect(b.frames).toEqual(a.frames);
      expect(b.result).toEqual(a.result);
      expect(a.frames.at(-1)!.stats.some((s) => s.label === EXACT)).toBe(false);
    }
  });

  it('no other stochastic kernel draws an evidence set', () => {
    const dir = 'src/kernels/stochastic';
    const users = readdirSync(dir).filter((f) => readFileSync(`${dir}/${f}`, 'utf8').includes('evidenceSet'));
    expect(users).toEqual([`${ID}.ts`]);
  });
});
