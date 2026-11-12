// Source-family's link threshold and shingle length become controls (S2 B7). A pair was linked
// at a word 3-shingle Jaccard similarity of 0.3 or more; now at the control threshold (default
// 0.3) over word k-shingles for the control shingle (default 3). Checked: each control exists,
// it travels in a shared link, it drives the readouts (the sources found are the connected
// components of the link graph, built here independently; n(n − 1)/2 pairs compared and at most
// n − 1 unions; at threshold 0 every pair links, so one source and n − 1 unions exactly), and
// the kernel's default trace is what it was before the controls existed.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/string';
import { input, KINDS, type Inputs } from '../src/engines/string/inputs';
import { trace, traceSteps } from '../src/engines/string/trace';
import { kernel, type FamilyResult } from '../src/kernels/string/source-family';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const ID = 'source-family';
/** The claims' seed (src/core/claims.ts DEFAULT_SEED) and the plate's default input. */
const SEED = 4242;
const N = KINDS.documents.size.value;

const entry = ENTRIES.find((e) => e.id === ID)!;
const plate = () => engine.plate({ id: ID, title: entry.title, group: entry.taxonomy }, kernel);
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const claim = (readout: string, params: Params): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect: { value: 0 }, setup: { params: params as Record<string, number> } });
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => Number((d.min + i * d.step).toFixed(10)));
const defOf = (key: string) => plate().params.find((x) => x.key === key) as RangeParam | undefined;
const inputs = () => [2, N, 12].flatMap((n) => [1, 2, SEED].map((seed) => input('documents', n, '', seed)));

/** Sources by the oracle: components of the graph linking J ≥ t (word k-shingles) or the same
 * credit and headline, by depth-first search; written here, never imported. */
function components({ docs }: Inputs['documents'], t: number, k: number): number {
  const sets = docs.map((d) => {
    const w = d.text.toLowerCase().split(/\s+/).filter(Boolean);
    const s = new Set<string>();
    for (let i = 0; i + k <= w.length; i++) s.add(w.slice(i, i + k).join(' '));
    if (!s.size && w.length) s.add(w.join(' '));
    return s;
  });
  const linked = (i: number, j: number) => {
    const inter = [...sets[i]].filter((x) => sets[j].has(x)).length;
    const uni = sets[i].size + sets[j].size - inter;
    const credit = docs[i].credit !== '' && docs[i].credit === docs[j].credit && docs[i].title === docs[j].title;
    return (uni ? inter / uni : 1) >= t || credit;
  };
  const seen = new Array<boolean>(docs.length).fill(false);
  let c = 0;
  for (let s = 0; s < docs.length; s++) {
    if (seen[s]) continue;
    c++;
    const stack = [s]; seen[s] = true;
    while (stack.length) {
      const i = stack.pop()!;
      for (let j = 0; j < docs.length; j++) if (!seen[j] && linked(i, j)) { seen[j] = true; stack.push(j); }
    }
  }
  return c;
}
const sources = (r: FamilyResult) => new Set(r.family).size;

describe('source-family: link threshold', () => {
  it('is a range control with the old constant 0.3 as its default', () => {
    expect(defOf('threshold')).toMatchObject({ kind: 'range', label: 'Link at Jaccard', min: 0, max: 1, step: 0.05, value: 0.3, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const t of [0, 0.15, 0.55, 1]) {
      expect(parse(defs, serialise(defs, { ...d, threshold: t }, 7)), `${t}`).toEqual({ seed: 7, params: { threshold: t } });
    }
  });

  it('finds the link graph\'s components, with n(n − 1)/2 pairs and at most n − 1 unions, at every setting', () => {
    const d = defOf('threshold');
    expect(d, 'the plate declares the control').toBeDefined();
    for (const t of settings(d!)) {
      for (const x of inputs()) {
        const tr = trace(kernel, x, { threshold: t });
        const n = x.docs.length;
        const at = `t=${t} n=${n}`;
        expect(sources(tr.result as FamilyResult), at).toBe(components(x, t, 3));
        expect(tr.counts[0], at).toBe((n * (n - 1)) / 2);
        // every union merges two sources: n − unions sources remain
        expect(tr.counts[1], at).toBe(n - sources(tr.result as FamilyResult));
        if (t === 0) expect(sources(tr.result as FamilyResult), at).toBe(1);
      }
    }
  }, 120_000);

  it('drives the plate\'s readouts', async () => {
    const x = input('documents', N, '', SEED);
    const n = x.docs.length;
    const one = await read(ID, claim('Sources found', { threshold: 0 }));
    expect(one.reason).toBeUndefined();
    expect(one.value).toBe(1);
    const u = await read(ID, claim('Unions', { threshold: 0 }));
    expect(u.value).toBe(n - 1);
    for (const t of [0.1, 0.6, 1]) {
      const s = await read(ID, claim('Sources found', { threshold: t }));
      expect(s.value, `t=${t}`).toBe(components(x, t, 3));
    }
  });
});

describe('source-family: shingle length', () => {
  it('is a range control with the old constant 3 as its default', () => {
    expect(defOf('shingle')).toMatchObject({ kind: 'range', label: 'Shingle length (words)', min: 1, max: 5, step: 1, value: 3, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plate().params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const k of [1, 2, 5]) expect(parse(defs, serialise(defs, { ...d, shingle: k }, 7)), `${k}`).toEqual({ seed: 7, params: { shingle: k } });
  });

  it('links over k-shingles: the link graph\'s components at every length and a few thresholds', () => {
    const d = defOf('shingle');
    expect(d, 'the plate declares the control').toBeDefined();
    for (const k of settings(d!)) {
      for (const t of [0, 0.1, 0.3, 0.8]) {
        for (const x of inputs()) {
          const tr = trace(kernel, x, { threshold: t, shingle: k });
          const n = x.docs.length;
          const at = `k=${k} t=${t} n=${n}`;
          expect(sources(tr.result as FamilyResult), at).toBe(components(x, t, k));
          expect(tr.counts[0], at).toBe((n * (n - 1)) / 2);
          expect(tr.counts[1], at).toBe(n - sources(tr.result as FamilyResult));
        }
      }
    }
  }, 120_000);

  it('drives the plate\'s readouts', async () => {
    const x = input('documents', N, '', SEED);
    for (const k of [1, 5]) {
      for (const t of [0.3, 0.6]) {
        const s = await read(ID, claim('Sources found', { shingle: k, threshold: t }));
        expect(s.reason).toBeUndefined();
        expect(s.value, `k=${k} t=${t}`).toBe(components(x, t, k));
      }
    }
  });
});

describe('source-family at its defaults is what it was before the controls', () => {
  // recorded on the code before the controls existed (779097a): every event and count
  const TRACES = '4133f6aea1708e11';
  const runs = (extra: Params) => inputs().map((x) => {
    const t = trace(kernel, x, extra);
    return [t.counts, hash(t.events.toArray())];
  });

  it('records the same trace, with the defaults passed or absent', () => {
    const absent = runs({});
    expect(hash(absent)).toBe(TRACES);
    expect(runs({ threshold: 0.3, shingle: 3 })).toEqual(absent);
  });

  it('pauses after each document\'s row of pairs, so linking every pair never fills one frame', () => {
    const x = input('documents', KINDS.documents.size.max, '', SEED);
    for (const threshold of [0, 0.3]) {
      const steps = traceSteps(kernel, x, { threshold });
      let pauses = 0;
      let r = steps.next();
      for (; !r.done; r = steps.next()) pauses++;
      expect(pauses, `threshold ${threshold}`).toBeGreaterThanOrEqual(x.docs.length - 1);
      expect(r.value.events.toArray()).toEqual(trace(kernel, x, { threshold }).events.toArray());
    }
  });
});
