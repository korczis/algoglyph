// The lease plate's constant becomes a control (S3 A5): the lock service granted every lease for
// 500 ms; now for the `ttl` control's milliseconds, whose default 500 is the old constant.
// Checked here: the control exists with its range, it travels in a shared link, and it drives
// what the plate reads: every lease lasts exactly its TTL, with fencing on no stale write lands,
// and the latest token is the number of leases granted, at every setting. The engine's defaults
// (and this kernel's recorded trace) are guarded in test/controls-crdt-convergence.test.ts.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import type { Params, RangeParam } from '../src/core/plate';
import { parse, serialise } from '../src/core/share';
import { engine } from '../src/engines/systems';
import { defaultParams, simulate, total, type SystemsKernel } from '../src/engines/systems/sim';
import type { LeaseResult } from '../src/kernels/systems/lease-fencing';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const modules = import.meta.glob<SystemsKernel>('../src/kernels/systems/[!_]*.ts', { import: 'kernel', eager: true });
const kernelOf = (id: string) => modules[`../src/kernels/systems/${id}.ts`];
const live = ENTRIES.filter((e) => e.engine === 'systems' && e.status === 'live');
const plateOf = (id: string) => {
  const e = live.find((x) => x.id === id)!;
  return engine.plate({ id: e.id, title: e.title, group: e.taxonomy }, kernelOf(id));
};
const ID = 'lease-fencing';
const SEEDS = [1, 2, 3, 5, 8, 13, 4242];

const settings = (d: RangeParam) => Array.from({ length: Math.round((d.max - d.min) / d.step) + 1 }, (_, i) => d.min + i * d.step);
const defOf = (key: string) => plateOf(ID).params.find((x) => x.key === key) as RangeParam | undefined;
const claim = (readout: string, params: Params, expect: Claim['expect'] = { value: 0 }): Claim =>
  ({ id: 'x', statement: 'a control test reading', readout, expect, setup: { params: params as Record<string, number | boolean> } });

describe('lease-fencing: lease time to live', () => {
  it('is a range control of the plate, the old constant its default', () => {
    // from 500: a shorter lease means more grants (about 2.5 times as many at 200 ms) and a
    // heavier run than any setting before the control; a longer one means fewer
    expect(defOf('ttl')).toMatchObject({ kind: 'range', label: 'Lease time to live (ms)', min: 200, max: 1500, step: 50, value: 500, rebuild: true });
  });

  it('round-trips through a shared link', () => {
    const defs = plateOf(ID).params;
    const d: Params = Object.fromEntries(defs.map((x) => [x.key, x.value]));
    for (const v of [550, 800, 1000, 1500]) {
      expect(parse(defs, serialise(defs, { ...d, ttl: v }, 7))).toEqual({ seed: 7, params: { ttl: v } });
    }
  });

  it('grants every lease for exactly ttl; fencing lets no stale write land; one token per grant', () => {
    const d = defOf('ttl');
    expect(d, 'the plate declares the control').toBeDefined();
    const k = kernelOf(ID) as SystemsKernel<LeaseResult>;
    for (const ttl of settings(d!)) for (const seed of SEEDS) for (const workers of [2, 3, 5]) {
      for (const pause of [0, 15, 50]) {
        const label = `ttl ${ttl} seed ${seed} workers ${workers} pause ${pause}`;
        const { net, result } = simulate(k, defaultParams(k, { ttl, workers, pause }), seed);
        result.grants.forEach((g, i) => {
          expect(g.token, label).toBe(i + 1);
          expect(g.expires[0] - g.t, label).toBeCloseTo(ttl, 6);
          // a renewal extends the lease by ttl from the moment the service sees it
          for (let j = 1; j < g.expires.length; j++) expect(g.expires[j], label).toBeGreaterThan(g.expires[j - 1]);
          // the service never grants a new lease while the last one has not expired
          if (i > 0) expect(g.t, label).toBeGreaterThanOrEqual(result.grants[i - 1].expires.at(-1)!);
        });
        let max = 0;
        for (const w of result.writes) {
          if (w.accepted) { expect(w.token, label).toBeGreaterThanOrEqual(max); max = w.token; }
        }
        expect(total(net, 'corrupting'), label).toBe(0);
        expect(total(net, 'grants'), label).toBe(result.grants.length);
      }
    }
  });

  it('drives the plate\'s readouts', async () => {
    for (const ttl of [1000, 1500]) {
      const s = await read(ID, claim('Stale writes accepted (fencing off)', { ttl }));
      expect(s.reason, `ttl ${ttl}`).toBeUndefined();
      expect(s.value, `ttl ${ttl}`).toBe(0);
      const t = await read(ID, claim('Latest token', { ttl }, { against: 'Leases granted', tolerance: 0 }));
      expect(t.reason, `ttl ${ttl}`).toBeUndefined();
      expect(t.value, `ttl ${ttl}: latest token − leases granted`).toBe(0);
    }
    // a longer lease is granted less often on the same seed: it is renewed, not re-granted
    const g500 = await read(ID, claim('Leases granted', {}));
    const g1500 = await read(ID, claim('Leases granted', { ttl: 1500 }));
    expect(g1500.value!, 'grants at 1,500 ms against 500 ms').toBeLessThan(g500.value!);
  });
});
