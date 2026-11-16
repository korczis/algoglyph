// The flow's command line (src/flow/cli.ts, scripts/flow.mjs): it answers from the same registry,
// validator and runtime as the editor, so a graph an agent proposes is accepted or refused for
// the same reason it would be in the page, and the process exits non-zero when it is refused.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { entries, nodes, preset, run, runKernel, runnable, validate } from '../src/flow/cli';
import { REGISTRY } from '../src/flow/nodes';
import { PRESETS } from '../src/flow/presets';

describe('flow cli', () => {
  it('lists every node type of the registry with its ports written out', () => {
    const list = nodes();
    expect(list.map((n) => n.type)).toEqual([...REGISTRY.keys()]);
    const fft = list.find((n) => n.type === 'fft')!;
    expect(fft.outputs).toEqual([{ id: 'out', type: 'Series<$U, axis Hz>' }]);
    expect(list.find((n) => n.type === 'grid')).toMatchObject({ level: 'derived' });
  });

  it('accounts for every live entry, filtered by level on request', () => {
    const all = entries();
    expect(all.entries.length).toBe(ENTRIES.filter((e) => e.status === 'live').length);
    const inferred = entries('inferred');
    expect(inferred.entries.length).toBe(all.tally.inferred);
    expect(inferred.entries.every((e) => e.level === 'inferred')).toBe(true);
  });

  it('round-trips every example through check, and refuses what the editor refuses', () => {
    for (const p of PRESETS) expect(validate(preset(p.id) as string), p.id).toMatchObject({ ok: true });
    const d = JSON.parse(preset('spectrum') as string);
    d.edges.push({ from: { node: 'fft', port: 'out' }, to: { node: 'wave', port: 'b' } });
    expect(validate(JSON.stringify(d))).toEqual({ ok: false, errors: [expect.stringContaining('Hz where s is expected')] });
    expect(validate('{"schema":"nope"}')).toMatchObject({ ok: false });
    expect(() => preset('none')).toThrow(/no preset none/);
  });

  it('runs a document headless and reports each node with its outputs summarised', async () => {
    const r = await run(preset('fit') as string);
    expect(r.ok).toBe(true);
    if (!('nodes' in r)) throw new Error('no nodes');
    const fit = r.nodes.find((n) => n.id === 'fit')!;
    expect(fit.status).toBe('done');
    expect(fit.outputs.fit).toMatchObject({ kind: 'record' });
    expect(fit.outputs.curve).toMatchObject({ kind: 'points', n: expect.any(Number) });
  });

  it('exits 0 for an accepted graph and 1 for a refused one, read from standard input', () => {
    const ok = spawnSync('node', ['scripts/flow.mjs', 'check', '-'], { input: preset('sorting') as string, encoding: 'utf8' });
    expect(ok.status, ok.stderr).toBe(0);
    expect(JSON.parse(ok.stdout)).toMatchObject({ ok: true });
    const bad = spawnSync('node', ['scripts/flow.mjs', 'check', '-'], { input: '{}', encoding: 'utf8' });
    expect(bad.status).toBe(1);
  }, 60_000);
});

describe('flow cli: a catalogue kernel on caller data', () => {
  const diamond = { n: 4, directed: true, s: 0, t: 3, edges: [
    { u: 0, v: 1, len: 1, cap: 2, cost: 1 }, { u: 1, v: 3, len: 1, cap: 1, cost: 1 }, { u: 0, v: 2, len: 1, cap: 1, cost: 2 },
    { u: 2, v: 3, len: 2, cap: 2, cost: 1 }, { u: 0, v: 3, len: 5, cap: 0, cost: 9 }, { u: 1, v: 2, len: 9, cap: 1, cost: 1 },
  ] };
  // every simple 0→3 path of the diamond and its length, enumerated here: the reference for k-shortest
  const lengths = [[0, 1, 3, 2], [0, 2, 3, 3], [0, 3, 5], [0, 1, 2, 3, 12]].map((p) => p[p.length - 1]).sort((a, b) => a - b);

  it('yen-k-shortest returns the k shortest simple paths of the caller\'s graph', async () => {
    const r = await runKernel('yen-k-shortest', JSON.stringify({ ...diamond, params: { k: 4 } }));
    if (!r.ok) throw new Error(r.errors.join('; '));
    expect((r.result as { paths: { cost: number }[] }).paths.map((p) => p.cost)).toEqual(lengths);
  });

  it('min-cost-flow sends the maximum flow at its least cost', async () => {
    // max flow 3: 0-1-3 (cost 2), 0-1-2-3 (cost 3), 0-2-3 (cost 3); the 0-3 edge has no capacity
    const r = await runKernel('min-cost-flow', JSON.stringify(diamond));
    if (!r.ok) throw new Error(r.errors.join('; '));
    expect(r.result).toMatchObject({ value: 3, cost: 8 });
  });

  it('bipartite-matching finds a maximum matching across the sides the caller gives', async () => {
    const r = await runKernel('bipartite-matching', JSON.stringify({ n: 4, side: [0, 0, 1, 1], edges: [{ u: 0, v: 2 }, { u: 0, v: 3 }, { u: 1, v: 2 }] }));
    if (!r.ok) throw new Error(r.errors.join('; '));
    const mate = (r.result as { mate: number[] }).mate;
    expect(mate.filter((m, v) => m >= 0 && v < 2).length).toBe(2);
    for (const [v, m] of mate.entries()) if (m >= 0) expect(mate[m]).toBe(v);
  });

  it('returns the operation trace on request, bounded', async () => {
    const r = await runKernel('dijkstra', JSON.stringify(diamond), { trace: true });
    if (!r.ok || !('trace' in r) || !r.trace) throw new Error('no trace');
    expect(r.trace.events).toBeGreaterThan(0);
    expect(r.trace.ops[0]).toHaveLength(5);
  });

  it('refuses malformed data with the field named, and engines it cannot read yet', async () => {
    expect(await runKernel('dijkstra', '{"n":2,"edges":[{"u":0,"v":5}]}')).toEqual({ ok: false, errors: ['edges[0]: u and v must be vertices 0..1'] });
    expect(await runKernel('dijkstra', '{"n":2,"edges":[],"params":{"nope":1}}')).toMatchObject({ ok: false, errors: [expect.stringContaining('params.nope')] });
    expect(await runKernel('dijkstra', 'not json')).toMatchObject({ ok: false });
    expect(await runKernel('quicksort', '{}')).toMatchObject({ ok: false, errors: [expect.stringContaining('array engine')] });
    expect(await runKernel('no-such-kernel', '{}')).toMatchObject({ ok: false });
  });

  it('lists every live graph kernel as runnable on caller data', async () => {
    const list = await runnable();
    expect(list.map((k) => k.id)).toEqual(ENTRIES.filter((e) => e.engine === 'graph' && e.status === 'live').map((e) => e.id).sort());
  });
});
