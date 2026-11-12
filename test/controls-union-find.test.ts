// The union-find plates' unions per site become one control (S5 C2): quick-find, quick-union,
// weighted quick-union and path compression share one parameter factory, so they stay in step.
// The workload made m = ⌈1.5 n⌉ connections; now m = ⌈p n⌉ for the control p, whose default
// 1.5 is the old constant (the chain input still lays its n − 1 links first). Checked: the
// control exists on each, it travels in a shared link, it drives what the plates read (the
// operations, the components, the height bounds), and every tree plate's default input, trace
// and controls are what they were before the control existed.
//
// One file for every union-find plate: they share the control's factory and its oracle.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/tree';
import { SHAPES, trace, workload, type Store, type TreeKernel } from '../src/engines/tree/trace';
import { loadLab } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const modules = import.meta.glob<TreeKernel>('../src/kernels/tree/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => modules[`../src/kernels/tree/${id}.ts`];
const live = ENTRIES.filter((e) => e.engine === 'tree' && e.status === 'live');
const plateOf = (id: string) => {
  const e = live.find((x) => x.id === id)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const UF = ['quick-find', 'quick-union', 'weighted-quick-union', 'path-compression'];
const KEY = 'perSite';
/** The plates' default number of sites and the claims' seed (src/core/claims.ts DEFAULT_SEED). */
const N = 24;
const SEED = 4242;

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const defaultsOf = (k: TreeKernel) => Object.fromEntries((k.params ?? []).map((p) => [p.key, Number(p.value)]));
const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);

/** Connections the workload makes: ⌈p n⌉, and at least the chain's n − 1 links on the chain. */
const connections = (shape: string, n: number, p: number) =>
  Math.max(shape === 'chain' ? n - 1 : 0, Math.ceil(p * n));

/** The forest's height in levels, a root alone being one level (the plate's Height readout). */
function levels(s: Store, n: number): number {
  let h = 0;
  for (let i = 0; i < n; i++) {
    let d = 1;
    for (let x = i; s.arr[x] !== x; x = s.arr[x]) d++;
    h = Math.max(h, d);
  }
  return h;
}

/** The oracle's height bound in levels after m connections over n sites (n ≥ 2). A union that
 * merges two trees joins at most m + 1 sites into one tree, and never more than n.
 * - quick-find: every site points at its component's label, a site that labels itself: 2 levels
 *   once any union merged, and the first connection always merges.
 * - quick-union: hanging root i under root j makes j's height max(h_j, h_i + 1), so one merging
 *   union adds at most one level: at most min(m, n − 1) + 1 levels.
 * - weighted (with or without compression): a site sinks a level only when its tree at least
 *   doubles, so a tree of s sites is at most ⌊lg s⌋ + 1 levels, s ≤ min(n, m + 1). */
function bound(id: string, n: number, m: number): number {
  if (id === 'quick-find') return 2;
  if (id === 'quick-union') return Math.min(m, n - 1) + 1;
  return Math.floor(Math.log2(Math.min(n, m + 1))) + 1;
}

const claim = (readout: string, params: Params, expect: Claim['expect'] = { value: 0 }): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number> } });

describe('union-find: unions per site', () => {
  it('is one range control on every union-find plate, the old constant its default', () => {
    for (const id of UF) {
      const d = plateOf(id).params.find((x) => x.key === KEY);
      expect(d, id).toMatchObject({ kind: 'range', label: 'Unions per site', min: 0.5, max: 1.5, step: 0.25, value: 1.5, rebuild: true });
      expect(kernelOf(id).params, `${id} declares it as the others do`).toEqual(kernelOf(UF[0]).params);
    }
  });

  it('round-trips through a shared link', () => {
    for (const id of UF) {
      const defs = plateOf(id).params;
      const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
      for (const p of [0.5, 0.75, 1, 1.25]) {
        expect(parse(defs, serialise(defs, { ...d, [KEY]: p }, 7)), `${id} ${p}`).toEqual({ seed: 7, params: { [KEY]: p } });
      }
    }
  });

  it('sets the number of connections, and the heights stay within their bounds, at every setting', () => {
    const d = kernelOf('quick-union').params?.find((x) => x.key === KEY) as RangeParam | undefined;
    expect(d, 'the kernel declares the control').toBeDefined();
    for (const p of settings(d!)) {
      for (const shape of SHAPES.pairs.map((s) => s.value)) {
        for (const n of [2, 3, 7, N, 61, 200]) {
          for (const seed of [1, 42, SEED]) {
            const w = workload('pairs', shape, n, seed, { [KEY]: p });
            const m = connections(shape, n, p);
            expect(w.pairs.length, `${shape} n=${n} p=${p}`).toBe(m);
            for (const id of UF) {
              const t = trace(kernelOf(id), w);
              const h = levels(t.store, n);
              expect(h, `${id} ${shape} n=${n} p=${p} seed=${seed}`).toBeLessThanOrEqual(bound(id, n, m));
              if (id === 'quick-find') expect(h).toBe(2);
              // the chain's n − 1 links come first: quick-union lays one path, the weighted ones a star
              if (shape === 'chain') expect(h, `${id} chain n=${n}`).toBe(id === 'quick-union' ? n : 2);
            }
          }
        }
      }
    }
  }, 120_000);

  it('drives the plates\' readouts', async () => {
    for (const id of UF) {
      for (const p of [0.5, 0.75, 1]) {
        const m = Math.ceil(p * N);
        const ops = await read(id, claim('Operation', { [KEY]: p }));
        expect(ops.reason, id).toBeUndefined();
        expect(ops.value, `${id} p=${p}`).toBe(m);
        // every connection merges two components or finds them connected already
        const comp = await read(id, claim('Components', { [KEY]: p }, { against: 'Already connected', against_number: 1, offset: 0, tolerance: 0 }));
        expect(comp.reason, id).toBeUndefined();
        expect(comp.value, `${id} p=${p}: components − connected = n − m`).toBe(N - m);
        const h = await read(id, claim('Height', { [KEY]: p }));
        expect(h.reason, id).toBeUndefined();
        expect(h.value!, `${id} p=${p}`).toBeLessThanOrEqual(bound(id, N, m));
      }
    }
  }, 120_000);
});

describe('the tree engine at the defaults is what it was before the control', () => {
  // recorded on the code before the control existed (main a1fc269)
  const TRACES = '973b97099616a871';
  const PARAMS = 'e5eb61521c9763f6';
  const UF_READOUTS = '05924c70ee8a675f';

  it('every tree kernel draws the same input and records the same trace', () => {
    const all = Object.keys(modules).sort().map((id) => {
      const k = modules[id];
      return SHAPES[k.input].map((s) => s.value).flatMap((shape) => [7, N].flatMap((n) => [1, SEED].map((seed) => {
        const { opts: _, ...w } = workload(k.input, shape, n, seed, defaultsOf(k));
        const t = trace(k, { ...w, opts: defaultsOf(k) });
        return [id, shape, n, seed, hash(w), hash(t.events), t.found, t.outputs, t.counts, t.ops.length];
      })));
    });
    expect(hash(all)).toBe(TRACES);
  }, 120_000);

  it('every tree plate and the union-find lab offer the same controls, the new one aside', async () => {
    // the controls added to other tree plates since (S2): each has its own test of its defaults
    const later = ['spare', 'letters'];
    const defs = live.map((e) => [e.id, plateOf(e.id).params.filter((d) => d.key !== KEY && !later.includes(d.key))]);
    const lab = await loadLab('union-find');
    expect(lab, 'the union-find lab').toBeDefined();
    expect(hash([defs, lab!.params])).toBe(PARAMS);
  });

  it('the union-find plates read the same at their defaults', async () => {
    const out: (string | undefined)[] = [];
    for (const id of UF) {
      for (const readout of ['Operation', 'Sites', 'Height', 'Average depth of a key', 'Nodes touched',
        'Array reads / writes', 'Cost per union', 'Already connected', 'Components']) {
        out.push((await read(id, claim(readout, {}))).text);
      }
    }
    expect(hash(out), JSON.stringify(out)).toBe(UF_READOUTS);
  }, 120_000);
});
