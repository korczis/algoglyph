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
    const selection = rows.find((r) => r.engine === 'array' && r.level === 'inferred');
    expect(selection?.reason).toMatch(/selection kernel/);
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

  it('refuses two adapters for one engine and an adapter whose node is not its declared type', () => {
    expect(() => deriveNodes([gridAdapter, gridAdapter], async () => ({}))).toThrow(/two adapters/);
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
