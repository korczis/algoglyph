// catalogue/entries/general-sweep.md: the sweep finds every crossing among n segments. Its plate
// publishes two readouts of that number, the `Crossings` counter and the `Crossings found` row;
// the settled plate must show the same count in both, and it must be the number of proper
// crossings an all-pairs test (sharing no code with the kernel) finds on the same input.
import { describe, expect, it } from 'vitest';
import { defaults } from '../src/core/plate';
import { makeInput } from '../src/engines/geometry/input';
import type { Pt, Seg } from '../src/engines/geometry/trace';
import { loadPlate } from '../src/registry';
import { read, type Claim } from './support/claims';
import { installBrowserStubs } from './support/p5-stub';

installBrowserStubs();

const SEEDS = [4242, 7];
const SHAPES = ['short', 'random'];

const cross = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Pairs whose segments cross properly: each one's ends lie strictly on both sides of the
 * other's line. */
function allPairsCrossings(segs: Seg[]): number {
  let k = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i]; const t = segs[j];
      const st = Math.sign(cross(s.a, s.b, t.a)) * Math.sign(cross(s.a, s.b, t.b));
      const ts = Math.sign(cross(t.a, t.b, s.a)) * Math.sign(cross(t.a, t.b, s.b));
      if (st < 0 && ts < 0) k++;
    }
  }
  return k;
}

const claim = (readout: string, seed: number, shape: string): Claim => ({
  id: `general-sweep-${readout}`, statement: `the settled plate reads ${readout}`,
  readout, expect: { above: -1 }, setup: { seed, params: { shape } },
});

describe('general-sweep settled readouts', () => {
  for (const seed of SEEDS) {
    for (const shape of SHAPES) {
      it(`count every crossing once in both readouts (seed ${seed}, ${shape})`, async () => {
        const plate = await loadPlate('general-sweep');
        const n = Number(defaults(plate!).n);
        const expected = allPairsCrossings(makeInput('segments', shape, n, seed).segments);
        const counted = await read('general-sweep', claim('Crossings', seed, shape));
        const found = await read('general-sweep', claim('Crossings found', seed, shape));
        expect(counted.reason).toBeUndefined();
        expect(found.reason).toBeUndefined();
        expect(found.value, 'Crossings found against all pairs').toBe(expected);
        expect(counted.value, 'Crossings against Crossings found').toBe(found.value);
      }, 120_000);
    }
  }
});
