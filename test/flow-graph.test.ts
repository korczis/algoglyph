// The flow's type system and graph validator (RFC docs/rfc/0001-typed-reactive-dag.md §4, §7):
// one compatibility function, a deterministic order, every cycle refused by name, and untrusted
// documents bounded and checked before anything runs.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import {
  canConnect, check, decodeGraph, encodeGraph, LIMITS, parseGraph, SCHEMA, serialiseGraph, topoOrder,
  type Edge, type GraphDoc,
} from '../src/flow/graph';
import { REGISTRY } from '../src/flow/nodes';
import { cardHeight, instance, layout, PRESETS } from '../src/flow/presets';
import { unify, type PortType } from '../src/flow/types';
import { parseRoute } from '../src/core/route';

const e = (from: string, fp: string, to: string, tp: string): Edge => ({ from: { node: from, port: fp }, to: { node: to, port: tp } });
const S = (unit: string, index: string): PortType => ({ kind: 'series', unit, index });

describe('unify: the one compatibility rule', () => {
  const cases: [PortType, PortType, boolean][] = [
    [S('1', 's'), S('1', 's'), true],
    [S('1', 's'), S('$U', '$I'), true],
    [S('V', 's'), S('1', 's'), false],
    [S('1', 'Hz'), S('$U', 's'), false],
    [S('1', 's'), S('$U', 'Hz'), false],
    [S('$U', '1'), S('1', '1'), true],
    [{ kind: 'points', x: 'm', y: 's' }, { kind: 'points', x: '$X', y: '$Y' }, true],
    [{ kind: 'points', x: 'm', y: 's' }, S('$U', '$I'), false],
    [{ kind: 'table', columns: [{ key: 'a', unit: 'm' }] }, { kind: 'table' }, true],
    [{ kind: 'record' }, { kind: 'record' }, true],
    [{ kind: 'record' }, { kind: 'table' }, false],
  ];
  it.each(cases)('%j into %j: %s', (out, inp, ok) => {
    expect(unify(out, inp).ok).toBe(ok);
  });

  it('a variable bound by one input constrains the next', () => {
    const b = unify(S('m', 's'), S('$U', '$I'));
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(unify(S('m', 's'), S('$U', '$I'), b.bindings).ok).toBe(true);
    const r = unify(S('m', 'Hz'), S('$U', '$I'), b.bindings);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('axis in Hz where s is expected');
  });

  it('never coerces: a mismatch names both units', () => {
    const r = unify(S('Hz', '1'), S('s', '1'));
    expect(r).toEqual({ ok: false, reason: 'values in Hz where s is expected: no implicit unit conversion' });
  });
});

/** A seeded random DAG: edges only from lower to higher index, so it is acyclic by construction. */
function randomDag(seed: number, n: number): { ids: string[]; edges: Edge[] } {
  const rnd = mulberry32(seed);
  const ids = Array.from({ length: n }, (_, i) => `n${String(i).padStart(2, '0')}`);
  const edges: Edge[] = [];
  for (let j = 1; j < n; j++) for (let i = 0; i < j; i++) if (rnd() < 0.2) edges.push(e(ids[i], 'o', ids[j], `i${i}`));
  return { ids, edges };
}

function shuffled<T>(xs: T[], rnd: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

describe('topological order', () => {
  it('respects every edge and does not depend on how the graph is listed (200 seeded DAGs)', () => {
    for (let s = 1; s <= 200; s++) {
      const { ids, edges } = randomDag(s, 4 + (s % 20));
      const { order, rest } = topoOrder(ids, edges);
      expect(rest).toEqual([]);
      const pos = new Map(order.map((id, i) => [id, i]));
      for (const x of edges) expect(pos.get(x.from.node)!).toBeLessThan(pos.get(x.to.node)!);
      const rnd = mulberry32(s * 7919);
      expect(topoOrder(shuffled(ids, rnd), shuffled(edges, rnd)).order).toEqual(order);
    }
  });

  it('leaves exactly the nodes on or behind a cycle', () => {
    const { rest } = topoOrder(['a', 'b', 'c', 'd'], [e('a', 'o', 'b', 'i'), e('b', 'o', 'c', 'i'), e('c', 'o', 'b', 'j'), e('c', 'o', 'd', 'i')]);
    expect(rest).toEqual(['b', 'c', 'd']);
  });
});

const fitDoc = (): GraphDoc => PRESETS.find((p) => p.id === 'fit')!.build(REGISTRY);

describe('check and canConnect', () => {
  it('every preset is a valid graph whose units resolve', () => {
    for (const p of PRESETS) {
      const c = check(p.build(REGISTRY), REGISTRY);
      expect(c.errors, p.id).toEqual([]);
      expect(c.order.length).toBe(p.build(REGISTRY).nodes.length);
    }
  });

  it('refuses a cycle and names it', () => {
    const d = fitDoc();
    // a second fit fed by the first fit's curve, feeding the first: fit → fit2 → fit
    const two: GraphDoc = { ...d, nodes: [...d.nodes, instance(REGISTRY, 'fit2', 'fit')], edges: d.edges.filter((x) => x.to.node !== 'fit') };
    const withChain: GraphDoc = { ...two, edges: [...two.edges, e('fit', 'curve', 'fit2', 'in')] };
    expect(check(withChain, REGISTRY).ok).toBe(true);
    const r = canConnect(withChain, e('fit2', 'curve', 'fit', 'in'), REGISTRY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/^a cycle Polynomial least squares → Polynomial least squares → Polynomial least squares/);
  });

  it('refuses a second edge into one input, an unknown port and a self-loop', () => {
    const d = fitDoc();
    expect(canConnect(d, e('fit', 'curve', 'scatter', 'points'), REGISTRY)).toMatchObject({ ok: false, reason: expect.stringContaining('already has a connection') });
    expect(canConnect(d, e('fit', 'nope', 'readout', 'in'), REGISTRY)).toMatchObject({ ok: false, reason: expect.stringContaining('has no output nope') });
    expect(canConnect(d, e('fit', 'curve', 'fit', 'in'), REGISTRY)).toEqual({ ok: false, reason: 'a node cannot feed itself' });
  });

  it('a spectrum in Hz cannot join a signal in seconds on one chart', () => {
    const d = PRESETS.find((p) => p.id === 'spectrum')!.build(REGISTRY);
    const r = canConnect(d, e('fft', 'out', 'wave', 'b'), REGISTRY);
    expect(r).toEqual({ ok: false, reason: 'Line chart, input Second series: axis in Hz where s is expected: no implicit unit conversion' });
    // a points output into a series input is a kind error, refused the same way
    expect(canConnect(fitDoc(), e('fit', 'fit', 'scatter', 'curve'), REGISTRY).ok).toBe(false);
  });

  it('a column takes the unit its approved schema declares', () => {
    const d = PRESETS.find((p) => p.id === 'table')!.build(REGISTRY);
    const approved: GraphDoc = { ...d, nodes: d.nodes.map((n) => (n.id === 'csv' ? { ...n, state: { columns: [{ key: 't', unit: 's' }, { key: 'v', unit: 'V' }] } } : n)) };
    const c = check({ ...approved, nodes: approved.nodes.map((n) => (n.id === 'column' ? { ...n, params: { index: 2 } } : n)) }, REGISTRY);
    expect(c.types.get('column')?.series).toEqual({ kind: 'series', unit: 'V', index: '1' });
    expect(c.types.get('stats')).toEqual({ out: { kind: 'record' } });
    const bad = check({ ...approved, nodes: approved.nodes.map((n) => (n.id === 'column' ? { ...n, params: { index: 3 } } : n)) }, REGISTRY);
    expect(bad.errors.map((x) => x.message)).toEqual(['Column: the table has 2 column(s), not 3']);
  });
});

describe('documents: canonical, round-tripped, bounded', () => {
  it('every preset round-trips through a link to the same canonical text', () => {
    for (const p of PRESETS) {
      const d = p.build(REGISTRY);
      const back = decodeGraph(encodeGraph(d), REGISTRY);
      expect(back.ok, p.id).toBe(true);
      if (back.ok) expect(serialiseGraph(back.doc)).toBe(serialiseGraph(d));
    }
  });

  it('the canonical text does not depend on the order parameters were set in', () => {
    const d = fitDoc();
    const flipped: GraphDoc = { ...d, nodes: d.nodes.map((n) => ({ ...n, params: Object.fromEntries(Object.entries(n.params).reverse()) })) };
    expect(serialiseGraph(flipped)).toBe(serialiseGraph(d));
  });

  it('layout is deterministic and the same for any listing', () => {
    const d = PRESETS.find((p) => p.id === 'table')!.build(REGISTRY);
    const rev: GraphDoc = { ...d, nodes: [...d.nodes].reverse(), edges: [...d.edges].reverse() };
    const at = (g: GraphDoc) => Object.fromEntries(layout(g, REGISTRY).nodes.map((n) => [n.id, n.at]));
    expect(at(rev)).toEqual(at(d));
  });

  it('cards laid out in one column never overlap', () => {
    for (const p of PRESETS) {
      const g = p.build(REGISTRY);
      for (const a of g.nodes) {
        for (const b of g.nodes) {
          if (a === b || a.at[0] !== b.at[0] || a.at[1] > b.at[1]) continue;
          expect(b.at[1] - a.at[1], `${p.id}: ${a.id} over ${b.id}`).toBeGreaterThanOrEqual(cardHeight(REGISTRY, a.type));
        }
      }
    }
  });

  const base = () => JSON.parse(serialiseGraph(fitDoc()));
  const refuse = (mut: (o: any) => unknown, why: RegExp) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const o = base();
    const text = typeof mut(o) === 'string' ? (mut(o) as string) : JSON.stringify(o);
    const r = parseGraph(text, REGISTRY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' | ')).toMatch(why);
  };

  it('refuses malicious or malformed documents with a reason', () => {
    refuse(() => 'x'.repeat(LIMITS.bytes + 1), /over \d+ bytes/);
    refuse(() => '{nope', /not JSON/);
    refuse(() => JSON.stringify({ schema: SCHEMA, seed: 1, nodes: [], edges: [], x: [[[[[[[[[[1]]]]]]]]]] }), /nests deeper/);
    refuse((o) => { o.schema = 'algoglyph.graph/v9'; }, /is not algoglyph\.graph\/v1/);
    refuse((o) => { o.nodes[0].id = '__proto__'; }, /id must match/);
    refuse((o) => { o.nodes[0].type = 'eval'; }, /no node type eval/);
    refuse((o) => { o.nodes[1].params.degree = 99; }, /degree = 99 is outside 0 … 8/);
    refuse((o) => { o.nodes[1].params.extra = 1; }, /has no parameter extra/);
    refuse((o) => { o.nodes[0].state = { pts: [[0, 9], [0, 0]] }; }, /inside the box/);
    refuse((o) => { o.nodes = Array.from({ length: LIMITS.nodes + 1 }, (_, i) => ({ ...o.nodes[0], id: `p${i}` })); }, /more than \d+ nodes/);
    refuse((o) => { o.edges.push({ from: { node: 'fit', port: 'curve' }, to: { node: 'fit', port: 'in' } }); }, /already has a connection|cycle/);
    refuse((o) => { o.seed = 0; }, /seed must be/);
    expect(decodeGraph('%%%', REGISTRY).ok).toBe(false);
    expect(decodeGraph(btoa('not json'), REGISTRY).ok).toBe(false);
  });

  it('a parameter added since a document was written takes its default', () => {
    const o = base();
    delete o.nodes.find((n: { id: string }) => n.id === 'fit').params.degree;
    const r = parseGraph(JSON.stringify(o), REGISTRY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.doc.nodes.find((n) => n.id === 'fit')?.params.degree).toBe(2);
  });
});

describe('the route', () => {
  it('#/flow opens the editor with its query; a deeper path does not', () => {
    expect(parseRoute('#/flow?g=abc')).toMatchObject({ view: 'flow', query: 'g=abc' });
    expect(parseRoute('#/flow')).toMatchObject({ view: 'flow', query: '' });
    expect(parseRoute('#/flow/x').view).toBe('browse');
  });
});
