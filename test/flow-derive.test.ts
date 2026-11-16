// The generic connection of the catalogue to the flow (RFC §5, rule project.typed-flow): every
// live entry is accounted for at exactly one level, the family nodes' choices are the catalogue's
// own entries (not a list typed here), an inferred entry is never runnable, adding an adapter
// promotes an engine's entries, and every derived kernel runs through its node and reports the
// same measurement its engine computes for the same instance.
import { describe, expect, it } from 'vitest';
import { ENTRIES, type Entry } from '../src/core/catalogue';
import { makeGraph } from '../src/engines/graph/graph';
import { defaultParams, EVENT_CAP, trace as graphTrace, work as graphWork, type GraphKernel } from '../src/engines/graph/trace';
import { run as gridRun, type GridKernel } from '../src/engines/grid/trace';
import { trace as hashTrace, type HashKernel } from '../src/engines/hash/table';
import { PLATE as HASH_PLATE, workload as hashWorkload } from '../src/engines/hash/workload';
import { input as stringInput, KINDS as STRING_KINDS } from '../src/engines/string/inputs';
import { trace as stringTrace, type StringKernel } from '../src/engines/string/trace';
import { SHAPES as TREE_SHAPES, SIZE as TREE_SIZE, trace as treeTrace, workload, type TreeKernel } from '../src/engines/tree/trace';
import { gridAdapter } from '../src/flow/adapters';
import { coverage, deriveNodes, headless, tally, type Adapter } from '../src/flow/derive';
import type { NodeDef } from '../src/flow/node';
import { ADAPTERS, DECLARED, library, REGISTRY } from '../src/flow/nodes';
import type { RecordValue, SeriesValue } from '../src/flow/types';
import { kernelLoader } from '../src/registry';

const live = ENTRIES.filter((e) => e.status === 'live');
const ctl = () => new AbortController().signal;
const rec = (v: unknown) => Object.fromEntries((v as RecordValue).rows.map((r) => [r.label, r.value]));
const runNode = (d: NodeDef, params: Record<string, string | number | boolean>, seed = 7) =>
  d.run({ nodeId: 'x', params, state: undefined, inputs: {}, seed, signal: ctl() });

describe('derivation from the catalogue', () => {
  const rows = coverage(DECLARED, ADAPTERS);

  it('accounts for every live entry exactly once, and for no planned one', () => {
    expect(rows.map((r) => r.id).sort()).toEqual(live.map((e) => e.id).sort());
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    const t = tally(rows);
    expect(t.declared + t.derived + t.inferred).toBe(live.length);
    for (const r of rows) expect(r.reason.length, r.id).toBeGreaterThan(10);
  });

  it('derives each family node\'s choices from the catalogue, not from a list in the code', () => {
    for (const a of ADAPTERS) {
      const d = REGISTRY.get(a.type)!;
      const want = live.filter((e) => e.engine === a.engine && a.refuse(e) === null).map((e) => e.id).sort();
      expect([...d.origin!.entries].sort(), a.type).toEqual(want);
      const sel = d.params.find((p) => p.key === d.origin!.param);
      expect(sel?.kind === 'select' && sel.options.map((o) => o.value).sort(), a.type).toEqual(want);
      for (const id of d.origin!.entries) expect(rows.find((r) => r.id === id)?.level, id).toBe('derived');
    }
  });

  it('follows the catalogue: an entry that goes live joins its family node, one that is planned leaves it', () => {
    const grid = live.filter((e) => e.engine === 'grid');
    const added: Entry = { ...grid[0], id: 'a-new-kernel', title: 'A new kernel' };
    const parked: Entry = { ...grid[1], status: 'planned' };
    const entries = [...ENTRIES.filter((e) => e.id !== grid[1].id), added, parked];
    const [node] = deriveNodes([gridAdapter], async () => ({}), entries);
    expect(node.origin!.entries).toContain('a-new-kernel');
    expect(node.origin!.entries).not.toContain(grid[1].id);
  });

  it('never makes a node of an inferred entry, and says why it is not one', () => {
    const runnable = new Set([...REGISTRY.values()].flatMap((d) => [...(d.origin?.entries ?? []), ...(d.entry ? [d.entry] : [])]));
    for (const r of rows.filter((x) => x.level === 'inferred')) expect(runnable.has(r.id), r.id).toBe(false);
    const custom = rows.find((r) => r.engine === 'custom');
    expect(custom?.level).toBe('inferred');
    expect(custom?.reason).toMatch(/lifted out/);
    // the array engine's two adapters partition it: a selection kernel is the select node's
    expect(rows.find((r) => r.id === 'quickselect')).toMatchObject({ level: 'derived', node: 'select' });
  });

  it('reads which engines run without drawing from the source tree, and proposes a node only for those', () => {
    for (const a of ADAPTERS) expect(headless(a.engine), a.engine).toBe(true);
    expect(headless('custom')).toBe(false);
    for (const r of rows.filter((x) => x.level === 'inferred' && x.engine !== 'array')) {
      expect(Boolean(r.proposal), r.id).toBe(headless(r.engine));
    }
  });

  it('promotes an engine\'s entries from inferred to derived when an adapter for it is added', () => {
    const engine = rows.find((r) => r.level === 'inferred' && r.proposal)!.engine;
    const probe: Adapter = {
      engine, type: `probe-${engine}`, signature: 'a probe adapter', refuse: () => null,
      node: () => ({ type: `probe-${engine}`, title: 'Probe', category: 'provider', summary: 'probe', params: [], inputs: [], outputs: [], run: () => ({}) }),
    };
    const after = coverage(DECLARED, [...ADAPTERS, probe]);
    for (const r of after.filter((x) => x.engine === engine)) expect(r.level, r.id).toBe('derived');
    expect(library([...ADAPTERS, probe]).some((d) => d.type === `probe-${engine}`)).toBe(true);
  });

  it('refuses two adapters that accept one entry or derive one type, and an adapter whose node is not its type', () => {
    expect(() => deriveNodes([gridAdapter, gridAdapter], async () => ({}))).toThrow(/two adapters derive the node type grid/);
    expect(() => deriveNodes([gridAdapter, { ...gridAdapter, type: 'grid2', node: (es, l) => ({ ...gridAdapter.node(es, l), type: 'grid2' }) }], async () => ({})))
      .toThrow(/accepted by both the grid and the grid2 adapter/);
    const liar: Adapter = { ...gridAdapter, type: 'not-grid' };
    expect(() => deriveNodes([liar], async () => ({}))).toThrow(/derived grid, not not-grid/);
  });
});

describe('derived kernels run through their engines', () => {
  const load = (id: string) => kernelLoader(live.find((e) => e.id === id)!)();

  it('every grid kernel reports its engine\'s own readouts for the same seeded instance', async () => {
    const d = REGISTRY.get('grid')!;
    for (const id of d.origin!.entries) {
      const k = (await load(id)) as GridKernel;
      const out = await runNode(d, { kernel: id, size: 'small' }, 7);
      const t = gridRun(k, k.size.min, 7);
      const r = rec(out.readouts);
      for (const m of k.readouts) expect(r[m.name], `${id} ${m.name}`).toBe(m.of(t.tally));
      expect(r.Work, id).toBe(t.tally.work);
      expect(Array.from((out.rows as SeriesValue).values), id).toEqual(Array.from(t.tally.computedByRow));
      // the same seed gives the same run
      expect(rec((await runNode(d, { kernel: id, size: 'small' }, 7)).readouts), id).toEqual(r);
    }
  });

  it('every graph kernel reports its engine\'s own counts for the same seeded graph', async () => {
    const d = REGISTRY.get('graph')!;
    for (const id of d.origin!.entries) {
      const k = (await load(id)) as GraphKernel;
      const n = k.n?.min ?? 6;
      const g = makeGraph(k.inputs[0], n, 7, 4 / 3);
      const t = graphTrace(k, g, { s: g.s, t: g.t, p: defaultParams(k) }, 7, k.cap ?? EVENT_CAP, false);
      const run = runNode(d, { kernel: id, size: 'small' }, 7);
      if (t.truncated) { await expect(run, id).rejects.toThrow(/event cap/); continue; }
      const r = rec((await run).counts);
      expect(r.Vertices, id).toBe(g.n);
      expect(r.Edges, id).toBe(g.m);
      expect(r.Work, id).toBe(graphWork(t.counts));
      if (t.counts.relaxations > 0) expect(r.Relaxations, id).toBe(t.counts.relaxations);
    }
  });

  it('refuses a kernel that is not one of the node\'s derived choices', async () => {
    await expect(runNode(REGISTRY.get('grid')!, { kernel: 'quicksort', size: 'small' })).rejects.toThrow(/not a kernel this node runs/);
  });
});

describe('tree and string kernels run through their engines', () => {
  const load = (id: string) => kernelLoader(live.find((e) => e.id === id)!)();

  it('every tree kernel reports its engine\'s own counts for the same seeded workload', async () => {
    const d = REGISTRY.get('tree')!;
    for (const id of d.origin!.entries) {
      const k = (await load(id)) as TreeKernel;
      const n = TREE_SIZE[k.input].min;
      const opts = Object.fromEntries((k.params ?? []).map((p) => [p.key, Number(p.value)]));
      const t = treeTrace(k, workload(k.input, TREE_SHAPES[k.input][0].value, n, 7, opts), false);
      const run = runNode(d, { kernel: id, size: 'small' }, 7);
      if (t.truncated) { await expect(run, id).rejects.toThrow(/event cap/); continue; }
      const r = rec((await run).counts);
      expect(r[TREE_SIZE[k.input].label], id).toBe(n);
      if (t.counts.compares > 0) expect(r['Key comparisons'], id).toBe(t.counts.compares);
      if (t.counts.writes > 0) expect(r['Array writes'], id).toBe(t.counts.writes);
    }
  });

  it('every string kernel reports its own counters for the same seeded input', async () => {
    const d = REGISTRY.get('text')!;
    for (const id of d.origin!.entries) {
      const k = (await load(id)) as StringKernel;
      const def = STRING_KINDS[k.input];
      const opts = Object.fromEntries((k.params ?? []).map((p) => [p.key, p.value]));
      const x = stringInput(k.input, def.size.min, k.shape ?? def.shapes[0]?.value ?? '', 7, opts as never);
      const t = stringTrace(k, x as never, opts);
      const run = runNode(d, { kernel: id, size: 'small' }, 7);
      if (t.truncated) { await expect(run, id).rejects.toThrow(/event cap/); continue; }
      const r = rec((await run).counts);
      t.labels.forEach((label, i) => expect(r[label], `${id} ${label}`).toBe(t.counts[i]));
    }
  });
});

describe('hash kernels run through their engine', () => {
  it('every hash kernel reports its engine\'s own counts for the plate\'s workload', async () => {
    const d = REGISTRY.get('hash')!;
    for (const id of d.origin!.entries) {
      const k = (await kernelLoader(live.find((e) => e.id === id)!)()) as HashKernel;
      const n = HASH_PLATE.nMin;
      const ld = k.maxLoad === undefined ? 100 : Math.min(HASH_PLATE.load, k.maxLoad);
      const opts = Object.fromEntries((k.params ?? []).map((p) => [p.key, p.value]));
      const t = hashTrace(k, hashWorkload('uniform', n, HASH_PLATE.deletes, 7), { n, m: Math.ceil(n / (ld / 100)), pageSize: HASH_PLATE.page, opts });
      const run = runNode(d, { kernel: id, size: 'small' }, 7);
      if (t.truncated) { await expect(run, id).rejects.toThrow(/event cap/); continue; }
      const r = rec((await run).counts);
      expect(r['Keys inserted'], id).toBe(n);
      expect(r.Hashes ?? 0, id).toBe(t.counts.hashes);
      expect(r.Probes ?? 0, id).toBe(t.counts.probes);
      expect(r.Writes ?? 0, id).toBe(t.counts.writes);
    }
  });
});

describe('selection kernels', () => {
  it('select the k-th smallest key like a sorted copy does', async () => {
    const d = REGISTRY.get('select')!;
    const keys = Float64Array.from({ length: 40 }, (_, i) => (i * 17) % 40 + 0.5);
    const sorted = Array.from(keys).sort((a, b) => a - b);
    for (const id of d.origin!.entries) {
      for (const rank of [1, 13, 40]) {
        const r = await d.run({ nodeId: 's', params: { kernel: id, rank }, state: undefined, seed: 1, signal: ctl(),
          inputs: { in: { kind: 'series', values: keys, unit: 'm', index: { unit: '1', start: 0, step: 1 }, label: 'k' } } });
        const sel = (r.selected as RecordValue).rows.find((x) => x.label === 'Selected key')!;
        expect(sel.value, `${id} ${rank}`).toBe(sorted[rank - 1]);
        expect(sel.unit).toBe('m');
      }
      await expect(d.run({ nodeId: 's', params: { kernel: id, rank: 41 }, state: undefined, seed: 1, signal: ctl(),
        inputs: { in: { kind: 'series', values: keys, unit: 'm', index: { unit: '1', start: 0, step: 1 }, label: 'k' } } })).rejects.toThrow(/past the 40 keys/);
    }
  });
});
