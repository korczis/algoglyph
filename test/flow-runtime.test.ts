// The flow's store and runtime (RFC §6, §7): every change is a validated intent, a moved point
// reaches the fit through the store and never along an edge, one change re-runs exactly what
// depends on it, a superseded run is dropped, and every computing node agrees with a reference
// computed here independently of the code under test.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { check, serialiseGraph, type GraphDoc } from '../src/flow/graph';
import { registry, Wait, type NodeDef } from '../src/flow/node';
import { declOf, inferSchema, library, REGISTRY, schemaError, seriesCsv, sortEntries, sortNode } from '../src/flow/nodes';
import { instance, PRESETS } from '../src/flow/presets';
import { Runtime, type Execution } from '../src/flow/runtime';
import { FlowStore, type Commit } from '../src/flow/store';
import type { PointsValue, RecordValue, SeriesValue, Value } from '../src/flow/types';

const preset = (id: string) => PRESETS.find((p) => p.id === id)!.build(REGISTRY);
const out = (x: Execution | null, node: string, port: string): Value => {
  const t = x?.nodes.get(node);
  if (!t || t.status !== 'done') throw new Error(`${node}: ${t?.status} ${t?.reason}`);
  return t.outputs[port];
};
const rec = (v: Value) => Object.fromEntries((v as RecordValue).rows.map((r) => [r.label, r.value]));

/** Least squares by the normal equations, solved by Gaussian elimination: independent of QR. */
function normalFit(xs: number[], ys: number[], d: number): number[] {
  const m = d + 1;
  const A = Array.from({ length: m }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (j < m
    ? xs.reduce((s, x) => s + x ** (i + j), 0) : xs.reduce((s, x, k) => s + ys[k] * x ** i, 0))));
  for (let c = 0; c < m; c++) {
    let p = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < m; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= m; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row, i) => row[m] / A[i][i]);
}

describe('the bidirectional loop: view → intent → state → recompute', () => {
  it('a dragged point moves the canonical state, and the fit follows it exactly', async () => {
    const store = new FlowStore(REGISTRY, preset('fit'));
    const rt = new Runtime(REGISTRY);
    const before = await rt.run(store.graph);
    const pts = out(before, 'points', 'points') as PointsValue;
    expect(pts.owner).toBe('points');
    // the scatter view sends this when a point is dropped; it never touches the fit itself
    const r = store.dispatch({ type: 'node.intent', node: pts.owner!, name: 'move', payload: { i: 3, x: 0.1, y: 1.2 } }, { origin: 'view', txn: 'drag-1' });
    expect(r.ok).toBe(true);
    const after = await rt.run(store.graph);
    const moved = out(after, 'points', 'points') as PointsValue;
    expect([moved.xs[3], moved.ys[3]]).toEqual([0.1, 1.2]);
    const want = normalFit(Array.from(moved.xs), Array.from(moved.ys), 2);
    const got = rec(out(after, 'fit', 'fit'));
    want.forEach((b, j) => expect(got[`a${j} (x^${j})`]).toBeCloseTo(b, 9));
    expect(store.log.at(-1)).toMatchObject({ origin: 'view', intent: 'node.intent:move', txn: 'drag-1' });
    // undo restores the state, and the recomputed fit is the first one again
    store.undo();
    const back = await rt.run(store.graph);
    expect(rec(out(back, 'fit', 'fit'))).toEqual(rec(out(before, 'fit', 'fit')));
    store.redo();
    expect(rec(out(await rt.run(store.graph), 'fit', 'fit'))).toEqual(got);
  });

  it('an invalid intent is refused and changes nothing', () => {
    const store = new FlowStore(REGISTRY, preset('fit'));
    const text = serialiseGraph(store.graph);
    for (const payload of [{ i: 99, x: 0, y: 0 }, { i: 0, x: 5, y: 0 }, { i: 0, x: NaN, y: 0 }, { i: 1.5, x: 0, y: 0 }, null]) {
      expect(store.dispatch({ type: 'node.intent', node: 'points', name: 'move', payload }, { origin: 'view' }).ok).toBe(false);
    }
    expect(store.dispatch({ type: 'node.intent', node: 'fit', name: 'move', payload: {} }, { origin: 'view' }))
      .toEqual({ ok: false, reason: 'Polynomial least squares does not accept move' });
    expect(store.dispatch({ type: 'param.set', node: 'fit', key: 'degree', value: 42 }, { origin: 'control' }).ok).toBe(false);
    expect(store.dispatch({ type: 'edge.add', edge: { from: { node: 'fit', port: 'curve' }, to: { node: 'fit', port: 'in' } } }, { origin: 'editor' }).ok).toBe(false);
    expect(serialiseGraph(store.graph)).toBe(text);
    expect(store.revision).toBe(0);
    expect(store.canUndo).toBe(false);
  });

  it('one gesture is one history entry; a new change clears redo', () => {
    const store = new FlowStore(REGISTRY, preset('fit'));
    for (let k = 1; k <= 5; k++) store.dispatch({ type: 'node.intent', node: 'points', name: 'move', payload: { i: 0, x: -0.9, y: k / 10 } }, { origin: 'view', txn: 'g' });
    store.dispatch({ type: 'param.set', node: 'fit', key: 'degree', value: 3 }, { origin: 'control' });
    store.undo();
    expect(store.graph.nodes.find((n) => n.id === 'fit')?.params.degree).toBe(2);
    expect((store.graph.nodes.find((n) => n.id === 'points')?.state as { pts: number[][] }).pts[0][1]).toBe(0.5);
    store.undo();
    expect(store.canUndo).toBe(false);
    expect(serialiseGraph(store.graph)).toBe(serialiseGraph(preset('fit')));
    store.redo();
    store.dispatch({ type: 'node.move', id: 'fit', at: [10, 10] }, { origin: 'editor' });
    expect(store.canRedo).toBe(false);
  });

  it('a listener that dispatches is queued behind the commit it hears (no reentrancy)', () => {
    const store = new FlowStore(REGISTRY, preset('fit'));
    const seen: Commit[] = [];
    let depth = 0;
    store.subscribe((c) => {
      depth++;
      expect(depth).toBe(1);
      seen.push(c);
      if (c.intent === 'param.set') store.dispatch({ type: 'node.move', id: 'fit', at: [1, 2] }, { origin: 'editor' });
      depth--;
    });
    store.dispatch({ type: 'param.set', node: 'fit', key: 'degree', value: 1 }, { origin: 'control' });
    expect(seen.map((c) => [c.revision, c.intent])).toEqual([[1, 'param.set'], [2, 'node.move']]);
    // moving a node is presentation: the computed revision stays at the parameter change
    expect(store.computeRevision).toBe(1);
  });
});

describe('incremental, cancellable execution', () => {
  it('re-runs exactly the nodes downstream of a change', async () => {
    const store = new FlowStore(REGISTRY, preset('fit'));
    const rt = new Runtime(REGISTRY);
    await rt.run(store.graph);
    const runs = () => Object.fromEntries(rt.runs);
    expect(runs()).toEqual({ points: 1, fit: 1, scatter: 1, readout: 1 });
    await rt.run(store.graph);
    expect(runs()).toEqual({ points: 1, fit: 1, scatter: 1, readout: 1 });
    store.dispatch({ type: 'param.set', node: 'fit', key: 'degree', value: 3 }, { origin: 'control' });
    const x = await rt.run(store.graph);
    expect(runs()).toEqual({ points: 1, fit: 2, scatter: 2, readout: 2 });
    expect(x?.nodes.get('points')?.cached).toBe(true);
    store.dispatch({ type: 'node.move', id: 'readout', at: [500, 500] }, { origin: 'editor' });
    await rt.run(store.graph);
    expect(runs()).toEqual({ points: 1, fit: 2, scatter: 2, readout: 2 });
  });

  it('a superseded run returns null and its result is dropped', async () => {
    let release: () => void = () => {};
    const slow: NodeDef = {
      type: 'slow', title: 'Slow', category: 'provider', summary: '', params: [], inputs: [],
      outputs: [{ id: 'o', label: 'O', type: { kind: 'record' } }],
      run: ({ signal }) => new Promise((res, rej) => {
        release = () => res({ o: { kind: 'record', rows: [] } });
        signal.addEventListener('abort', () => rej(new Error('aborted')));
      }),
    };
    const reg = registry([slow, ...library()]);
    const doc: GraphDoc = { schema: 'algoglyph.graph/v1', seed: 1, nodes: [{ id: 's', type: 'slow', params: {}, at: [0, 0] }], edges: [] };
    const rt = new Runtime(reg);
    const first = rt.run(doc);
    const second = rt.run(doc);
    release();
    expect(await first).toBeNull();
    expect((await second)?.nodes.get('s')?.status).toBe('done');
  });

  it('a failed node blocks what depends on it and names why', async () => {
    const d = preset('fit');
    const one = { ...d, nodes: d.nodes.map((n) => (n.id === 'points' ? { ...n, state: { pts: [[0, 0], [0, 1]] } } : n)) };
    const x = await new Runtime(REGISTRY).run(one);
    expect(x?.nodes.get('fit')).toMatchObject({ status: 'error', reason: 'a degree-2 polynomial needs 3 distinct x values, the points have 1' });
    expect(x?.nodes.get('readout')).toMatchObject({ status: 'blocked' });
    // the scatter still shows the points, so the reader can drag them back; it says the curve is missing
    expect(x?.nodes.get('scatter')).toMatchObject({ status: 'done', reason: expect.stringContaining('Curve unavailable') });
  });

  it('a node whose output contradicts its declared type is an error, not a value', async () => {
    const liar: NodeDef = {
      type: 'liar', title: 'Liar', category: 'provider', summary: '', params: [], inputs: [],
      outputs: [{ id: 'o', label: 'O', type: { kind: 'series', unit: 's', index: '1' } }],
      run: () => ({ o: { kind: 'series', values: new Float64Array(1), unit: 'Hz', index: { unit: '1', start: 0, step: 1 }, label: '' } }),
    };
    const reg = registry([liar]);
    const x = await new Runtime(reg).run({ schema: 'algoglyph.graph/v1', seed: 1, nodes: [{ id: 'l', type: 'liar', params: {}, at: [0, 0] }], edges: [] });
    expect(x?.nodes.get('l')).toMatchObject({ status: 'error', reason: 'O: values in Hz where s is expected: no implicit unit conversion' });
  });
});

describe('nodes against independent references', () => {
  it('every sorting kernel the catalogue lists sorts like Float64Array.prototype.sort', async () => {
    const choices = sortEntries();
    expect(choices.length).toBeGreaterThan(0);
    const keys = Float64Array.from({ length: 48 }, (_, i) => 1 + ((i * 37) % 48));
    const want = Array.from(keys.slice().sort());
    const node = sortNode();
    for (const e of choices) {
      const r = await node.run({
        nodeId: 's', params: { kernel: e.id }, state: undefined, seed: 1, signal: new AbortController().signal,
        inputs: { in: { kind: 'series', values: keys, unit: '1', index: { unit: '1', start: 0, step: 1 }, label: 'k' } },
      });
      expect(Array.from((r.sorted as SeriesValue).values), e.id).toEqual(want);
      expect(rec(r.counts).Compares + rec(r.counts).Writes, e.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('the sort preset counts exactly one bubble-sort exchange per inversion of its keys', async () => {
    const d = preset('sorting');
    const ins = { ...d, nodes: d.nodes.map((n) => (n.id === 'sort' ? { ...n, params: { kernel: 'bubble-sort' } } : n)) };
    const x = await new Runtime(REGISTRY).run(ins);
    const keys = Array.from((out(x, 'keys', 'keys') as SeriesValue).values);
    let inv = 0;
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) if (keys[i] > keys[j]) inv++;
    // an adjacent exchange removes exactly one inversion, and bubble sort exchanges only adjacent
    // keys out of order (Knuth 5.2.2), so its exchanges are the input's inversions
    expect(rec(out(x, 'sort', 'counts')).Swaps).toBe(inv);
  });

  it('a non-comparison kernel refuses keys that are not non-negative integers', async () => {
    const r = sortNode().run({
      nodeId: 's', params: { kernel: 'lsd-radix-sort' }, state: undefined, seed: 1, signal: new AbortController().signal,
      inputs: { in: { kind: 'series', values: Float64Array.of(0.5, 0.25), unit: '1', index: { unit: '1', start: 0, step: 1 }, label: 'k' } },
    });
    await expect(r).rejects.toThrow(/sorts non-negative integer keys/);
  });

  it('the spectrum matches a direct DFT and puts each tone in its bin', async () => {
    const d = preset('spectrum');
    const clean = { ...d, nodes: d.nodes.map((n) => (n.id === 'signal' ? { ...n, params: { ...n.params, noise: 0, samples: '256', rate: '256', f1: 12, f2: 40, a2: 0.5 } } : n)) };
    const x = await new Runtime(REGISTRY).run(clean);
    const sig = Array.from((out(x, 'signal', 'signal') as SeriesValue).values);
    const spec = out(x, 'fft', 'out') as SeriesValue;
    const N = sig.length;
    for (let k = 0; k <= N / 2; k++) {
      let re = 0; let im = 0;
      for (let t = 0; t < N; t++) { re += sig[t] * Math.cos((2 * Math.PI * k * t) / N); im -= sig[t] * Math.sin((2 * Math.PI * k * t) / N); }
      const amp = (Math.hypot(re, im) * (k === 0 || k === N / 2 ? 1 : 2)) / N;
      expect(spec.values[k]).toBeCloseTo(amp, 9);
    }
    expect(spec.index).toEqual({ unit: 'Hz', start: 0, step: 1 });
    expect(spec.values[12]).toBeCloseTo(1, 9);
    expect(spec.values[40]).toBeCloseTo(0.5, 9);
  });

  it('statistics match a direct computation, in the series unit', async () => {
    const st = REGISTRY.get('stats')!;
    const v = [3, 1, 4, 1, 5, 9, 2, 6];
    const r = await st.run({ nodeId: 's', params: {}, state: undefined, seed: 1, signal: new AbortController().signal, inputs: { in: { kind: 'series', values: Float64Array.from(v), unit: 'm', index: { unit: '1', start: 0, step: 1 }, label: '' } } });
    const rows = (r.out as RecordValue).rows;
    const mean = 31 / 8;
    expect(rec(r.out)).toMatchObject({ Count: 8, Mean: mean, Minimum: 1, Maximum: 9, Median: 3.5 });
    expect(rec(r.out)['Standard deviation']).toBeCloseTo(Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / 7), 12);
    expect(rows.find((x) => x.label === 'Mean')?.unit).toBe('m');
  });

  it('a straight-line fit equals the closed form', async () => {
    const rnd = mulberry32(5);
    const xs = Array.from({ length: 20 }, (_, i) => -1 + i / 10);
    const ys = xs.map((x) => 0.7 * x - 0.2 + 0.1 * (rnd() - 0.5));
    const r = await REGISTRY.get('fit')!.run({
      nodeId: 'f', params: { degree: 1 }, state: undefined, seed: 1, signal: new AbortController().signal,
      inputs: { in: { kind: 'points', xs: Float64Array.from(xs), ys: Float64Array.from(ys), x: 's', y: 'm', label: '' } },
    });
    const mx = xs.reduce((a, b) => a + b) / xs.length; const my = ys.reduce((a, b) => a + b) / ys.length;
    const b = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    expect(rec(r.fit)['a1 (x^1)']).toBeCloseTo(b, 10);
    expect(rec(r.fit)['a0 (x^0)']).toBeCloseTo(my - b * mx, 10);
    expect((r.fit as RecordValue).rows.find((x) => x.label === 'a1 (x^1)')?.unit).toBe('m/s');
  });
});

describe('a reader\'s table (ADR 0010 rule user-data-stays-local)', () => {
  const text = 'Time,Voltage\n0,1.5\n1,0.25\n2,3\n3,-1\n';

  it('a schema inferred from the header is a proposal: units unknown, nothing read until approved', async () => {
    const s = inferSchema(text);
    expect(s).toEqual({ columns: [{ key: 'time', unit: '1' }, { key: 'voltage', unit: '1' }] });
    const doc = preset('table');
    const rt = new Runtime(REGISTRY, (id) => (id === 'csv' ? { text, digest: 'd1' } : undefined));
    const x = await rt.run(doc);
    expect(x?.nodes.get('csv')).toMatchObject({ status: 'waiting', reason: expect.stringContaining('approve the schema') });
    expect(x?.nodes.get('chart')?.status).toBe('waiting');
  });

  it('approved, the table flows in its units; the document and its link carry no data', async () => {
    const store = new FlowStore(REGISTRY, preset('table'));
    expect(store.dispatch({ type: 'node.intent', node: 'csv', name: 'schema', payload: { columns: [{ key: 'time', unit: 's' }, { key: 'voltage', unit: 'V' }] } }, { origin: 'control' }).ok).toBe(true);
    store.dispatch({ type: 'param.set', node: 'column', key: 'index', value: 2 }, { origin: 'control' });
    const rt = new Runtime(REGISTRY, (id) => (id === 'csv' ? { text, digest: 'd1' } : undefined));
    const x = await rt.run(store.graph);
    expect(Array.from((out(x, 'sort', 'sorted') as SeriesValue).values)).toEqual([0, 0.3125, 0.625, 1]);
    expect(rec(out(x, 'stats', 'out')).Maximum).toBe(3);
    expect((out(x, 'stats', 'out') as RecordValue).rows[1].unit).toBe('V');
    expect(check(store.graph, REGISTRY).types.get('column')?.series).toEqual({ kind: 'series', unit: 'V', index: '1' });
    const doc = serialiseGraph(store.graph);
    for (const v of ['1.5', '0.25', '-1', 'Voltage\n']) expect(doc).not.toContain(v);
    expect(seriesCsv(out(x, 'sort', 'sorted') as SeriesValue)).toBe('axis_1,value_1\n1,0\n2,0.3125\n3,0.625\n4,1\n');
  });

  it('a malformed table is refused by row and column, through the shared parser', async () => {
    const store = new FlowStore(REGISTRY, preset('table'));
    store.dispatch({ type: 'node.intent', node: 'csv', name: 'schema', payload: { columns: [{ key: 'time', unit: 's' }, { key: 'voltage', unit: 'V' }] } }, { origin: 'control' });
    const rt = new Runtime(REGISTRY, () => ({ text: 'time,voltage\n0,1\n1,0x10\n', digest: 'd2' }));
    const x = await rt.run(store.graph);
    expect(x?.nodes.get('csv')).toMatchObject({ status: 'error', reason: expect.stringMatching(/row 3 column voltage/) });
    expect(x?.nodes.get('export')?.status).toBe('blocked');
  });

  it('a schema is checked before it is approved', () => {
    expect(schemaError({ columns: [] })).toMatch(/from 1 to 8/);
    expect(schemaError({ columns: [{ key: 'A b', unit: 's' }] })).toMatch(/must match/);
    expect(schemaError({ columns: [{ key: 'a', unit: '' }] })).toMatch(/is not a unit/);
    expect(schemaError({ columns: [{ key: 'a', unit: 's' }, { key: 'a', unit: 'm' }] })).toMatch(/named twice/);
    expect(declOf({ columns: [{ key: 'a', unit: 's' }] }).bytes).toBeGreaterThan(0);
  });

  it('nodes that wait are not failures', () => {
    expect(new Wait('x')).toBeInstanceOf(Error);
    expect(instance(REGISTRY, 'c', 'csv').state).toBeNull();
  });
});
