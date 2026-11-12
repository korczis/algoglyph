// The orthogonal-sweep plate's horizontal share: a control whose default (50 %) is the old
// alternation (horizontal iff i is even), which round-trips through a shared link and drives the
// sweep's event count the way its closed form predicts.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { defaults, type RangeParam } from '../src/core/plate';
import { mulberry32 } from '../src/core/random';
import { parse, serialise } from '../src/core/share';
import { DEFAULT_SHAPES, isHorizontal, makeInput, orthogonal } from '../src/engines/geometry/input';
import { record, type InputKind } from '../src/engines/geometry/trace';
import { kernel } from '../src/kernels/geometry/orthogonal-sweep';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

// Every geometry input at its defaults, over a few sizes and seeds, compared within one run: with
// no params against the control's default passed explicitly. A hash recorded on one machine is no
// guard: inputs carry float64 from sin, cos and exp, which may differ by an ulp on another CPU.
function defaultInputsHash(extra: Record<string, number> = {}): string {
  const h = createHash('sha256');
  for (const [kind, shapes] of Object.entries(DEFAULT_SHAPES)) {
    for (const shape of shapes) {
      for (const n of [2, 3, 60, 120, 400]) {
        for (const seed of [1, 4242, 4302]) {
          h.update(JSON.stringify(makeInput(kind as InputKind, shape, n, seed, { ...extra })));
        }
      }
    }
  }
  return h.digest('hex');
}

const N_MAX = 400; // the kernel's largest n
const SHARES = [10, 20, 30, 40, 50];

describe('orthogonal-sweep horiz', () => {
  it('is a range control 10..50 by 10 whose default is the old alternation, 50 %', async () => {
    const plate = await loadPlate('orthogonal-sweep');
    const d = plate!.params.find((p) => p.key === 'horiz') as RangeParam | undefined;
    expect(d).toBeDefined();
    const { kind, label, min, max, step, value } = d!;
    expect({ kind, label, min, max, step, value })
      .toEqual({ kind: 'range', label: 'Horizontal share (%)', min: 10, max: 50, step: 10,
        value: 50 });
  });

  it('round-trips through a shared link', async () => {
    const plate = await loadPlate('orthogonal-sweep');
    const want = { ...defaults(plate!), horiz: 30 };
    const back = parse(plate!.params, serialise(plate!.params, want, 7));
    expect(back.seed).toBe(7);
    expect(back.params.horiz).toBe(30);
  });

  it('at 50 % is horizontal exactly for the even i, up to the largest n', () => {
    for (let i = 0; i < N_MAX; i++) expect(isHorizontal(i, 50), `i = ${i}`).toBe(i % 2 === 0);
  });

  it('leaves every geometry input bit-identical at its default', () => {
    expect(defaultInputsHash({ horiz: 50 })).toBe(defaultInputsHash());
    const a = makeInput('orthogonal', 'mixed', 60, 4242, {});
    expect(makeInput('orthogonal', 'mixed', 60, 4242, { horiz: 50 })).toEqual(a);
  });

  it('makes ⌈n · s⌉ horizontals, drawing three numbers per segment at every share', () => {
    for (const pct of SHARES) {
      for (let n = 0; n <= N_MAX; n++) {
        let calls = 0;
        const r = mulberry32(n + pct);
        const segs = orthogonal(n, () => { calls++; return r(); }, pct);
        const h = segs.filter((s) => s.a.y === s.b.y).length;
        const v = segs.filter((s) => s.a.x === s.b.x).length;
        expect(h, `n = ${n}, ${pct} %`).toBe(Math.ceil((n * pct) / 100));
        expect(h + v).toBe(n);
        expect(calls).toBe(3 * n);
      }
    }
  });

  // The pairs a sweep can find are h · v = n² s (1 − s), largest at s = 1/2, and the events
  // 2h + v = n (1 + s) grow with s: half and half is the heaviest share. One seed's tree can make
  // a 40 % run a little dearer than the same seed at 50 % (seed 4242: 22790 comparisons against
  // 22360), within the spread the default itself has across seeds; so each share is held to the
  // most the default reaches on the same seeds.
  it('is never heavier than the default at the largest n, over the default seeds', () => {
    const counters = kernel.counters.map(([k]) => k);
    const seeds = [1, 4242, 4642];
    const at = (pct: number, seed: number) => record(kernel,
      makeInput('orthogonal', 'mixed', N_MAX, seed, { horiz: pct }), { horiz: pct }, seed,
      false).counts;
    const top: Record<string, number> = {};
    for (const seed of seeds) {
      const c = at(50, seed);
      for (const k of counters) top[k] = Math.max(top[k] ?? 0, c[k] ?? 0);
    }
    for (const pct of SHARES) {
      for (const seed of seeds) {
        const c = at(pct, seed);
        for (const k of counters) {
          expect(c[k] ?? 0, `seed ${seed}, ${pct} %, ${k}`).toBeLessThanOrEqual(top[k]);
        }
      }
    }
  });

  it('handles 2h + v events: at 10 % and 30 % of 60 segments, 66 and 78', async () => {
    for (const [pct, events] of [[10, 66], [30, 78], [50, 90]]) {
      const c: Claim = {
        id: 'probe', statement: '', readout: 'Events', expect: { value: events },
        setup: { params: { horiz: pct } },
      };
      const r = await read('orthogonal-sweep', c);
      expect(r.reason).toBeUndefined();
      expect(r.value, `${pct} %`).toBe(events);
    }
  }, 120_000);
});
