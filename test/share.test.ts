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

import { HashWriter, parseSeed, SEED_MAX, snap } from '../src/core/share';
import { shouldRun } from '../src/core/loop';
import { parseRoute } from '../src/core/route';
import type { RangeParam } from '../src/core/plate';

const onGrid = (d: RangeParam, v: number) => {
  if (!(d.step > 0)) return true;
  const k = (v - d.min) / d.step;
  return Math.abs(k - Math.round(k)) < 1e-6;
};

async function everyRange(): Promise<{ id: string; d: RangeParam }[]> {
  const out: { id: string; d: RangeParam }[] = [];
  for (const e of ENTRIES.filter((x) => x.status === 'live')) {
    for (const d of (await loadPlate(e.id))!.params) if (d.kind === 'range') out.push({ id: e.id, d });
  }
  for (const l of CATALOGUE.labs) {
    if (!labRunnable(l.id)) continue;
    for (const d of (await loadLab(l.id))!.params) if (d.kind === 'range') out.push({ id: `lab-${l.id}`, d });
  }
  return out;
}

describe('review round: values, seeds, routes and timing', () => {
  it('every range default lies on its own slider grid, so a link never moves it', async () => {
    for (const { id, d } of await everyRange()) {
      expect(onGrid(d, d.value), `${id}.${d.key} = ${d.value} on step ${d.step}`).toBe(true);
    }
  });

  it('values beyond a range clamp to its last grid point and round-trip', async () => {
    for (const { id, d } of await everyRange()) {
      const beyond = d.max + 3 * (d.step > 0 ? d.step : 1);
      const v = parse([d], `${d.key}=${beyond}`).params[d.key] as number;
      expect(v, `${id}.${d.key}`).toBeLessThanOrEqual(d.max);
      expect(onGrid(d, v), `${id}.${d.key}`).toBe(true);
      expect(parse([d], serialise([d], { [d.key]: v }, 1)).params[d.key] ?? d.value).toBe(v);
    }
  });

  it('accepts only plain decimal numbers', () => {
    for (const bad of ['0x20', '0b111', '0o17', 'Infinity', '1,5', ' ', '--3']) {
      expect(parse(defs, `n=${encodeURIComponent(bad)}`).params.n, bad).toBeUndefined();
    }
    expect(parse(defs, 'n=4.5e1').params.n).toBe(45);
    expect(parse(defs, 'n=.5e2').params.n).toBe(50);
  });

  it('clamps without snapping when a step is not positive', () => {
    const d: RangeParam = { kind: 'range', key: 'x', label: 'x', min: 0, max: 1, step: 0, value: 0.5 };
    expect(snap(d, 0.123)).toBe(0.123);
    expect(snap(d, 7)).toBe(1);
    expect(snap({ ...d, step: -1 }, 0.3)).toBe(0.3);
  });

  it('reads the seed in one place and refuses seeds that would alias', () => {
    expect(parseSeed('seed=42')).toBe(42);
    expect(parseSeed(`seed=${SEED_MAX}`)).toBe(SEED_MAX);
    for (const bad of ['0', '-1', '1.5', '1e3', '0x10', String(SEED_MAX + 1), '4294967338', '']) {
      expect(parseSeed(`seed=${bad}`), bad).toBeUndefined();
    }
    expect(parse(defs, 'seed=4294967338').seed).toBeUndefined();
  });

  it('a malformed percent-encoding is an unknown route, not an exception', () => {
    expect(() => parseRoute('#/p/%E0%A4%A')).not.toThrow();
    expect(parseRoute('#/p/%E0%A4%A').view).toBe('browse');
    const live = ENTRIES.find((e) => e.status === 'live')!;
    expect(parseRoute(`#/p/${live.id}?seed=7&x=1`)).toMatchObject({ view: 'plate', id: live.id, seed: 7 });
    expect(parseRoute(`#/p/${live.id}?seed=4294967338`).seed).toBeUndefined();
  });

  it('leaving a plate cancels a pending URL write', () => {
    const jobs: (() => void)[] = [];
    const w = new HashWriter(250, {
      set: (fn: () => void) => { jobs.push(fn); return jobs.length as unknown as ReturnType<typeof setTimeout>; },
      clear: (id) => { jobs[(id as unknown as number) - 1] = () => {}; },
    });
    let writes = 0;
    w.schedule(() => { writes++; });
    expect(w.pending).toBe(true);
    w.cancel(); // what route() does on every navigation
    jobs.forEach((j) => j());
    expect(writes).toBe(0);
    w.schedule(() => { writes++; });
    jobs[jobs.length - 1]();
    expect(writes).toBe(1);
  });

  it('the default timers call the globals with a valid receiver (browsers refuse others)', () => {
    const real = { set: globalThis.setTimeout, clear: globalThis.clearTimeout };
    const strict = (fn: (...a: unknown[]) => unknown) => function (this: unknown, ...a: unknown[]) {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      return fn.apply(globalThis, a);
    };
    globalThis.setTimeout = strict(real.set as never) as unknown as typeof setTimeout;
    globalThis.clearTimeout = strict(real.clear as never) as unknown as typeof clearTimeout;
    try {
      const w = new HashWriter(0);
      expect(() => w.schedule(() => {})).not.toThrow();
      expect(() => w.cancel()).not.toThrow();
    } finally {
      globalThis.setTimeout = real.set;
      globalThis.clearTimeout = real.clear;
    }
  });

  it('a reset burst runs a paused plate and ends with the pause', () => {
    expect(shouldRun({ userPaused: true, visible: true, burst: 0 })).toBe(false);
    expect(shouldRun({ userPaused: true, visible: true, burst: 5 })).toBe(true);
    expect(shouldRun({ userPaused: false, visible: false, burst: 0 })).toBe(false);
    expect(shouldRun({ userPaused: false, visible: true, burst: 0 })).toBe(true);
  });
});

import { freshSeed } from '../src/core/random';
import type { ParamValue } from '../src/core/plate';

describe('review round 2: seed range, canonical order, length, float noise', () => {
  it('freshSeed draws only seeds a shared link accepts', () => {
    const real = Math.random;
    try {
      for (const r of [0, 1e-12, 0.5, 1 - 1e-12]) {
        Math.random = () => r;
        const s = freshSeed();
        expect(parseSeed(`seed=${s}`), String(r)).toBe(s);
      }
    } finally {
      Math.random = real;
    }
  });

  it('writes changed parameters in definition order whatever the object order', () => {
    const forward = { n: 65, dt: 0.0045, mode: 'b', trail: false };
    const backward = { trail: false, mode: 'b', dt: 0.0045, n: 65 };
    expect(serialise(defs, backward, 3)).toBe(serialise(defs, forward, 3));
    expect(serialise(defs, forward, 3)).toBe('seed=3&n=65&dt=0.0045&mode=b&trail=0');
  });

  it('writes code-set float noise on the control grid', () => {
    expect(serialise(defs, { n: 40, dt: 0.0030000000000000005, mode: 'a', trail: true }, 1))
      .toBe('seed=1');
    const d: RangeParam = { kind: 'range', key: 'x', label: 'x', min: 0, max: 3, step: 0.1, value: 1 };
    expect(serialise([d], { x: 1.4000000000000001 }, 1)).toBe('seed=1&x=1.4');
  });

  it('every live plate and lab fits its longest link in 1024 characters', async () => {
    const longest = (d: ParamDef): ParamValue => {
      if (d.kind === 'toggle') return !d.value;
      if (d.kind === 'select') {
        return d.options.reduce((a, o) => (o.value.length > a.length && o.value !== d.value ? o.value : a), '');
      }
      return [d.min, d.max].reduce((a, v) => (String(v).length > String(a).length ? v : a));
    };
    const plates: { id: string; params: ParamDef[] }[] = [];
    for (const e of ENTRIES.filter((x) => x.status === 'live')) plates.push({ id: `p/${e.id}`, params: (await loadPlate(e.id))!.params });
    for (const l of CATALOGUE.labs) if (labRunnable(l.id)) plates.push({ id: `lab/${l.id}`, params: (await loadLab(l.id))!.params });
    for (const { id, params } of plates) {
      const v: Params = {};
      for (const d of params) v[d.key] = longest(d) || d.value;
      const url = `https://korczis.github.io/algoglyph/#/${id}?${serialise(params, v, SEED_MAX)}`;
      expect(url.length, id).toBeLessThanOrEqual(1024);
    }
  });

});

describe('the collection status filter in the route', () => {
  it('reads ?status= on the collection and on a taxonomy node, and ignores anything else', () => {
    expect(parseRoute('#/?status=live').status).toBe('live');
    expect(parseRoute('#/?status=planned').view).toBe('browse');
    expect(parseRoute('#/?status=planned').status).toBe('planned');
    expect(parseRoute('#/?status=bogus').status).toBeUndefined();
    expect(parseRoute('#/').status).toBeUndefined();
  });
});
