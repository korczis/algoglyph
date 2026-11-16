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
  });
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
    const graph = list.filter((k) => k.engine === 'graph').map((k) => k.id);
    expect(graph).toEqual(ENTRIES.filter((e) => e.engine === 'graph' && e.status === 'live').map((e) => e.id).sort());
    expect(list.map((k) => k.id)).toContain('knapsack-dp');
  });
});

describe('flow cli: a grid kernel on caller data', () => {
  // the optimum by brute force over every subset: the reference for the DP
  const brute = (w: number[], v: number[], cap: number) => {
    let best = 0;
    for (let m = 0; m < 1 << w.length; m++) {
      let tw = 0; let tv = 0;
      for (let i = 0; i < w.length; i++) if (m & (1 << i)) { tw += w[i]; tv += v[i]; }
      if (tw <= cap && tv > best) best = tv;
    }
    return best;
  };

  it('knapsack-dp finds the best value and a set of items that achieves it', async () => {
    const data = { weights: [5, 4, 6, 3, 7, 2], values: [10, 40, 30, 50, 35, 15], capacity: 13 };
    const r = await runKernel('knapsack-dp', JSON.stringify(data));
    if (!r.ok) throw new Error(r.errors.join('; '));
    const res = r.result as { best: number; items: number[] };
    expect(res.best).toBe(brute(data.weights, data.values, data.capacity));
    expect(res.items.reduce((s, i) => s + data.weights[i], 0)).toBeLessThanOrEqual(data.capacity);
    expect(res.items.reduce((s, i) => s + data.values[i], 0)).toBe(res.best);
  });

  it('refuses malformed knapsack data with the field named', async () => {
    expect(await runKernel('knapsack-dp', '{"weights":[1,0],"values":[1,1],"capacity":3}')).toMatchObject({ ok: false, errors: [expect.stringContaining('weights')] });
    expect(await runKernel('knapsack-dp', '{"weights":[1],"values":[1,2],"capacity":3}')).toMatchObject({ ok: false, errors: [expect.stringContaining('values')] });
    expect(await runKernel('knapsack-dp', '{"weights":[1],"values":[1],"capacity":1e9}')).toMatchObject({ ok: false, errors: [expect.stringContaining('capacity')] });
    expect(await runKernel('n-queens', '{}')).toMatchObject({ ok: false, errors: [expect.stringContaining('no data form')] });
  });
});

describe('flow cli: serve', () => {
  it('answers one JSON line per request line, in order, and keeps serving after a bad one', () => {
    const reqs = [
      { id: 1, cmd: 'kernel', kernel: 'knapsack-dp', input: { weights: [2, 3], values: [3, 4], capacity: 5 } },
      'not json',
      { id: 2, cmd: 'nope' },
      { id: 3, cmd: 'check', graph: preset('fit') },
    ];
    const p = spawnSync('node', ['scripts/flow.mjs', 'serve'], { input: reqs.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n'), encoding: 'utf8' });
    expect(p.status, p.stderr).toBe(0);
    const out = p.stdout.trim().split('\n').map((l) => JSON.parse(l));
    expect(out).toHaveLength(4);
    expect(out[0]).toMatchObject({ id: 1, ok: true, result: { best: 7, items: [0, 1] } });
    expect(out[1]).toMatchObject({ ok: false });
    expect(out[2]).toMatchObject({ id: 2, ok: false, errors: [expect.stringContaining('unknown cmd')] });
    expect(out[3]).toMatchObject({ id: 3, ok: true });
  });
});

describe('flow cli: numeric and stochastic kernels on caller data (src/core/solve.ts)', () => {
  const ok = async (id: string, data: unknown) => {
    const r = await runKernel(id, JSON.stringify(data));
    if (!r.ok) throw new Error(r.errors.join('; '));
    return r.result as Record<string, unknown>;
  };
  // every vertex of {x >= 0, A x <= b} in the plane, by intersecting each pair of boundary lines:
  // the optimum of a bounded LP is at one of them, so the best is the reference for the simplex
  const bestVertex = (A: number[][], b: number[], c: number[]) => {
    const lines = [...A.map((r, i) => [r[0], r[1], b[i]]), [-1, 0, 0], [0, -1, 0]];
    let best = -Infinity;
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
      const [a1, b1, c1] = lines[i]; const [a2, b2, c2] = lines[j];
      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) < 1e-12) continue;
      const x = (c1 * b2 - c2 * b1) / det; const y = (a1 * c2 - a2 * c1) / det;
      if (x >= -1e-9 && y >= -1e-9 && A.every((r, k) => r[0] * x + r[1] * y <= b[k] + 1e-9)) best = Math.max(best, c[0] * x + c[1] * y);
    }
    return best;
  };

  it('simplex-method solves the textbook program and agrees with vertex enumeration', async () => {
    // max 3x + 5y with x <= 4, 2y <= 12, 3x + 2y <= 18: the optimum is (2, 6), value 36
    expect(await ok('simplex-method', { A: [[1, 0], [0, 2], [3, 2]], b: [4, 12, 18], c: [3, 5] })).toMatchObject({ status: 'optimal', x: [2, 6], value: 36 });
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let t = 0; t < 20; t++) {
      const A = Array.from({ length: 2 + (t % 5) }, () => [0.1 + rnd(), 0.1 + rnd()]);
      const b = A.map(() => 0.5 + rnd());
      const c = [rnd(), rnd()];
      for (const rule of ['bland', 'dantzig']) {
        const r = await ok('simplex-method', { A, b, c, rule });
        expect(r.status).toBe('optimal');
        expect(r.value as number).toBeCloseTo(bestVertex(A, b, c), 9);
      }
    }
  });

  it('simplex-method reports an unbounded program and refuses an infeasible origin with the field named', async () => {
    expect(await ok('simplex-method', { A: [[1, -1]], b: [1], c: [1, 1] })).toMatchObject({ status: 'unbounded', value: null });
    expect(await runKernel('simplex-method', '{"A":[[1,0]],"b":[-1],"c":[1,1]}')).toMatchObject({ ok: false, errors: [expect.stringContaining('b must')] });
    expect(await runKernel('simplex-method', '{"A":[[1,0],[1]],"b":[1,1],"c":[1,1]}')).toMatchObject({ ok: false, errors: [expect.stringContaining('A[1]')] });
    expect(await runKernel('simplex-method', '{"A":[[1]],"b":[1],"c":[1],"max":true}')).toMatchObject({ ok: false, errors: [expect.stringContaining('unknown field max')] });
  });

  it('pert-monte-carlo matches the closed-form mean of a chain and shows the merge bias of parallel paths', async () => {
    // in a chain the length is the sum of the durations, so its mean is the sum of PERT means (a + 4m + b) / 6
    const chain = [{ a: 1, m: 2, b: 6 }, { a: 2, m: 3, b: 4, after: [0] }, { a: 0, m: 5, b: 7, after: [1] }];
    const expected = chain.reduce((s, t) => s + (t.a + 4 * t.m + t.b) / 6, 0);
    const r = await ok('pert-monte-carlo', { tasks: chain, runs: 20000, seed: 3 });
    expect(r.deterministic as number).toBeCloseTo(expected, 12);
    expect(Math.abs((r.mean as number) - expected)).toBeLessThan(5 * (r.stderr as number));
    expect((r.criticality as { share: number }[]).map((c) => c.share)).toEqual([1, 1, 1]);
    // two equal parallel tasks into a merge: E[max] > max E, so the simulated mean exceeds the plan
    const merge = await ok('pert-monte-carlo', { tasks: [{ a: 1, m: 3, b: 9 }, { a: 1, m: 3, b: 9 }, { a: 1, m: 1.5, b: 2, after: [0, 1] }], runs: 20000 });
    expect((merge.mean as number) - (merge.deterministic as number)).toBeGreaterThan(5 * (merge.stderr as number));
    expect(merge.p50 as number).toBeLessThanOrEqual(merge.p80 as number);
    expect(merge.p80 as number).toBeLessThanOrEqual(merge.p90 as number);
    // seeded: the same data gives the same answer
    expect(await ok('pert-monte-carlo', { tasks: chain, runs: 500, seed: 9 })).toEqual(await ok('pert-monte-carlo', { tasks: chain, runs: 500, seed: 9 }));
  });

  it('pert-monte-carlo refuses a network out of topological order and bad durations', async () => {
    expect(await runKernel('pert-monte-carlo', '{"tasks":[{"a":1,"m":2,"b":3,"after":[1]},{"a":1,"m":2,"b":3}]}')).toMatchObject({ ok: false, errors: [expect.stringContaining('tasks[0].after')] });
    expect(await runKernel('pert-monte-carlo', '{"tasks":[{"a":3,"m":2,"b":1}]}')).toMatchObject({ ok: false, errors: [expect.stringContaining('tasks[0]')] });
    expect(await runKernel('pert-monte-carlo', '{"tasks":[{"a":1,"m":2,"b":3}],"runs":0}')).toMatchObject({ ok: false, errors: [expect.stringContaining('runs')] });
  });

  it('bayes-update gives the conjugate posterior, its credible ends exact, and the grid within a cell', async () => {
    // flat prior, 3 events and 1 none: Beta(4, 2), whose distribution function is 5x^4 - 4x^5
    const r = await ok('bayes-update', { successes: 3, failures: 1 });
    expect(r).toMatchObject({ prior: [1, 1], posterior: [4, 2], level: '90%' });
    expect(r.mean as number).toBeCloseTo(2 / 3, 12);
    expect(r.sd as number).toBeCloseTo(Math.sqrt(8 / (36 * 7)), 12);
    const cdf = (x: number) => 5 * x ** 4 - 4 * x ** 5;
    expect(cdf(r.lower as number)).toBeCloseTo(0.05, 9);
    expect(cdf(r.upper as number)).toBeCloseTo(0.95, 9);
    const g = r.grid as { cells: number; mean: number; lower: number; upper: number };
    expect(Math.abs(g.mean - (r.mean as number))).toBeLessThan(1 / g.cells);
    expect(Math.abs(g.lower - (r.lower as number))).toBeLessThanOrEqual(1 / g.cells + 1e-12);
    expect(Math.abs(g.upper - (r.upper as number))).toBeLessThanOrEqual(1 / g.cells + 1e-12);
    expect(await ok('bayes-update', { successes: 30, failures: 70, prior: [2, 8], credible: 0.95 })).toMatchObject({ posterior: [32, 78], level: '95%' });
  });

  it('bayes-update refuses an unknown prior or level with the field named', async () => {
    expect(await runKernel('bayes-update', '{"successes":1,"failures":1,"credible":0.5}')).toMatchObject({ ok: false, errors: [expect.stringContaining('credible')] });
    expect(await runKernel('bayes-update', '{"successes":1,"failures":1,"prior":"optimistic"}')).toMatchObject({ ok: false, errors: [expect.stringContaining('prior')] });
    expect(await runKernel('bayes-update', '{"successes":-1,"failures":1}')).toMatchObject({ ok: false, errors: [expect.stringContaining('successes')] });
  });

  it('track-planning plans on the research export\'s layers: bridges a river, refuses a malformed map', async () => {
    const hex = (r: string) => [...r].map((c) => `0${c}`).join('');
    const map = { heights: Array(7).fill(hex('1111100011111')), types: Array(7).fill('CCCCCWWCCCCCC'), from: { x: 0, y: 3, dir: 'SW' }, to: { x: 11, y: 3 } };
    expect(await ok('track-planning', map)).toMatchObject({ status: 'found', counts: { bridges: 1, sharp: 0 } });
    expect(await runKernel('track-planning', JSON.stringify({ ...map, from: { x: 0, y: 3, dir: 'UP' } }))).toMatchObject({ ok: false, errors: [expect.stringContaining('from.dir')] });
  });

  it('human-pointing answers a seeded move that ends on its target, and refuses a bad seed', async () => {
    const r = await ok('human-pointing', { from: [0, 0], to: [900, 400], width: 40, seed: 7 });
    const samples = r.samples as number[][];
    expect(samples[samples.length - 1].slice(0, 2)).toEqual([900, 400]);
    expect(await runKernel('human-pointing', '{"from":[0,0],"to":[1,1],"seed":1.5}')).toMatchObject({ ok: false, errors: [expect.stringContaining('seed')] });
  });

  it('action-plan orders a plan and expands it into presses, and refuses one that overdraws', async () => {
    const r = await ok('action-plan', { actions: [{ id: 'repay', kind: 'repay_loan', amount: 50000 }], cash: 80000, loan: 50000, loan_step: 10000 });
    expect((r.steps as unknown[]).length).toBe(5);
    expect(await runKernel('action-plan', JSON.stringify({ actions: [{ id: 'buy', kind: 'buy_vehicle', cost: 9 }], cash: 5 }))).toMatchObject({ ok: false, errors: [expect.stringContaining('overdraws')] });
  });

  it('transport-investment ranks a demand\'s routes by ROI and refuses a demand to nowhere', async () => {
    const bus = { mode: 'bus', build_per_tile: 60, terminal: 1000, vehicle: { name: 'bus', price: 8000, running_per_year: 1500, capacity: 31, speed_kmh: 56 }, overhead_periods: 1 };
    const r = await ok('transport-investment', { places: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 30, y: 0 }], demands: [{ id: 'd', from: 'A', to: 'B', cargo: 'passengers', volume: 300, payment: 3185, td1: 0, td2: 24, two_way: true }], modes: [bus] });
    expect(r.why).toMatchObject([{ demand: 'd', mode: 'bus' }]);
    expect(await runKernel('transport-investment', JSON.stringify({ places: [{ id: 'A', x: 0, y: 0 }], demands: [{ id: 'd', from: 'A', to: 'Z', cargo: 'c', volume: 1, payment: 1, td1: 0, td2: 0 }], modes: [bus] }))).toMatchObject({ ok: false, errors: [expect.stringContaining('two different places')] });
  });

  it('lists every declared data form, with the shape it reads', async () => {
    const list = await runnable();
    for (const id of ['simplex-method', 'pert-monte-carlo', 'bayes-update', 'track-planning', 'human-pointing', 'action-plan', 'transport-investment']) expect(list.find((k) => k.id === id)).toMatchObject({ input: expect.stringContaining('{') });
  });
});
