import { describe, expect, it } from 'vitest';
import { ENTRIES, CATALOGUE } from '../src/core/catalogue';
import { defaults, type ParamDef, type Params } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { labRunnable, loadLab, loadPlate } from '../src/registry';

const defs: ParamDef[] = [
  { kind: 'range', key: 'n', label: 'N', min: 10, max: 100, step: 5, value: 40 },
  { kind: 'range', key: 'dt', label: 'dt', min: 0.0005, max: 0.01, step: 0.0005, value: 0.003 },
  {
    kind: 'select', key: 'mode', label: 'Mode', value: 'a',
    options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
  },
  { kind: 'toggle', key: 'trail', label: 'Trail', value: true },
];

/** Every control at a non-default value: a range at its maximum, a toggle flipped, a select at
 * its last option. */
function altered(base: Params, def: ParamDef): Params {
  const out = { ...base };
  if (def.kind === 'range') out[def.key] = def.max;
  else if (def.kind === 'toggle') out[def.key] = !def.value;
  else out[def.key] = def.options[def.options.length - 1].value;
  return out;
}

function roundTrips(id: string, params: ParamDef[]): void {
  const d: Params = {};
  for (const p of params) d[p.key] = p.value;
  expect(parse(params, serialise(params, d, 99)), id).toEqual({ seed: 99, params: {} });
  for (const def of params) {
    const want = altered(d, def);
    const back = parse(params, serialise(params, want, 1)).params;
    expect({ ...d, ...back }, `${id}.${def.key}`).toEqual(want);
  }
}

describe('shareable parameters', () => {
  it('omits defaults and round-trips every changed value', () => {
    const base = { n: 40, dt: 0.003, mode: 'a', trail: true };
    expect(serialise(defs, base, 7)).toBe('seed=7');
    const changed = { n: 65, dt: 0.0045, mode: 'b', trail: false };
    expect(parse(defs, serialise(defs, changed, 7))).toEqual({ seed: 7, params: changed });
  });

  it('clamps and snaps ranges to their control', () => {
    expect(parse(defs, 'n=1000').params.n).toBe(100);
    expect(parse(defs, 'n=-3').params.n).toBe(10);
    expect(parse(defs, 'n=62').params.n).toBe(60);
    expect(parse(defs, 'dt=0.00312').params.dt).toBe(0.003);
  });

  it('drops values that do not fit their control and ignores unknown keys', () => {
    expect(parse(defs, 'n=abc&n2=5&mode=zzz&trail=maybe&dt=&seed=-4'))
      .toEqual({ seed: undefined, params: {} });
  });

  it('round-trips the parameters of every live entry', async () => {
    for (const e of ENTRIES.filter((x) => x.status === 'live')) {
      const p = await loadPlate(e.id);
      roundTrips(e.id, p!.params);
      expect(defaults(p!)).toBeTruthy();
    }
  });

  it('round-trips the parameters of every runnable lab', async () => {
    for (const l of CATALOGUE.labs) {
      if (!labRunnable(l.id)) continue;
      const p = await loadLab(l.id);
      roundTrips(`lab-${l.id}`, p!.params);
    }
  });
});
