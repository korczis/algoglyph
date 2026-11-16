// The flow's command line (src/flow/cli.ts, scripts/flow.mjs): it answers from the same registry,
// validator and runtime as the editor, so a graph an agent proposes is accepted or refused for
// the same reason it would be in the page, and the process exits non-zero when it is refused.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { entries, nodes, preset, run, validate } from '../src/flow/cli';
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
