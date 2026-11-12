// The shared parts of the bespoke sorting plates (src/plates/_shared/): the SplitMix64 mirror
// against a BigInt transcription of the kernel prelude's generator, the tracer's clock, the
// textbook quantities against brute force, the live series and the power fit.
import { describe, expect, it } from 'vitest';
import { SplitMix64 } from '../src/plates/_shared/kernel-mirror/rng';
import { items, Stepper, Tracer, type Algorithm } from '../src/plates/_shared/kernel-mirror/tracer';
import { powerFit, Series, Trials } from '../src/plates/_shared/live-chart/series';
import { input, runSeed } from '../src/plates/_shared/sort-input/input';
import {
  arrangements, cycleType, factorial, harmonic, partitions, solve,
} from '../src/plates/_shared/theory/combinatorics';

const M64 = (1n << 64n) - 1n;

/** prelude.rs SplitMix64, transcribed with BigInt: the independent reference. */
class RefSplitMix {
  constructor(private s: bigint) {}
  next(): bigint {
    this.s = (this.s + 0x9e3779b97f4a7c15n) & M64;
    let z = this.s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & M64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & M64;
    return z ^ (z >> 31n);
  }
  below(n: number): number {
    return Number((this.next() * BigInt(n)) >> 64n);
  }
}

function permutationsOf(n: number): number[][] {
  if (n === 0) return [[]];
  return permutationsOf(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n, ...p.slice(i)]));
}

describe('SplitMix64 mirror', () => {
  it('draws the kernel generator\'s 64-bit outputs bit for bit', () => {
    for (const seed of [0, 1, 0x5eed1234, 2 ** 32 - 1, 2 ** 32, 2 ** 53 - 1, 123456789012345]) {
      const a = new SplitMix64(seed);
      const b = new RefSplitMix(BigInt(seed));
      for (let i = 0; i < 2000; i++) {
        const [h, l] = a.nextU64();
        expect((BigInt(h) << 32n) | BigInt(l)).toBe(b.next());
      }
    }
  });

  it('draws the same bounded integers (below, range)', () => {
    const a = new SplitMix64(42);
    const b = new RefSplitMix(42n);
    for (let i = 0; i < 20000; i++) {
      const n = 1 + (i % 1000);
      expect(a.below(n)).toBe(b.below(n));
    }
    expect(new SplitMix64(9).range(5, 5)).toBe(5);
    expect(() => new SplitMix64(1).below(1 << 20)).toThrow(RangeError);
  });
});

describe('tracer mirror', () => {
  it('counts every operation as one step and stops at the limit', () => {
    const t = new Tracer(1, 5);
    const a = items([3, 1, 2]);
    expect(t.cmp(a, 0, 1)).toBe(1);
    t.swap(a, 0, 1);
    t.set(a, 2, 9, 7);
    t.read(0);
    t.mark(0, 3, 'x');
    expect(a.key).toEqual([1, 3, 9]);
    expect(a.tag).toEqual([1, 0, 7]);
    expect(t.counts).toEqual({ cmp: 1, swap: 1, write: 1, read: 1 });
    expect(t.steps).toBe(5);
    expect(t.ok()).toBe(true);
    t.phase('over');
    expect(t.ok()).toBe(false);
  });

  it('a stepper advances by the steps asked and runs to the end', () => {
    const t = new Tracer(0);
    const a = items([1, 2, 3, 4]);
    function* walk(): Algorithm {
      for (let i = 1; i < 4; i++) {
        t.cmp(a, i - 1, i);
        yield;
      }
      return 'sorted';
    }
    const s = new Stepper(walk(), t);
    s.advance(2);
    expect(t.steps).toBe(2);
    expect(s.done).toBe(false);
    expect(s.finish()).toBe('sorted');
    expect(t.steps).toBe(3);
  });
});

describe('textbook quantities', () => {
  it('factorial, harmonic numbers and arrangements of a multiset', () => {
    expect([0, 1, 5, 10].map(factorial)).toEqual([1, 1, 120, 3628800]);
    expect(harmonic(4)).toBeCloseTo(25 / 12, 12);
    // brute force: distinct arrangements of [1, 1, 2, 3] counted from all orderings
    const keys = [1, 1, 2, 3];
    const seen = new Set(permutationsOf(4).map((p) => p.map((i) => keys[i - 1]).join(',')));
    expect(arrangements(keys)).toBe(seen.size);
  });

  it('partitions of n are counted by the partition numbers', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => partitions(n).length)).toEqual([1, 2, 3, 5, 7, 11, 15, 22]);
  });

  it('the cycle type of a sorting permutation, against brute force on every permutation of 5', () => {
    // brute force: the cycle-type counts must be n!/z_λ, e.g. 24 five-cycles and 1 identity
    const count = new Map<string, number>();
    for (const p of permutationsOf(5)) {
      const k = cycleType(p).join(',');
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    expect(count.get('5')).toBe(24);
    expect(count.get('1,1,1,1,1')).toBe(1);
    expect(count.get('2,1,1,1')).toBe(10);
    expect(count.get('3,2')).toBe(20);
    expect(cycleType([2, 1, 3])).toEqual([2, 1]);
  });

  it('solves a small linear system', () => {
    const x = solve([[2, 1], [1, 3]], [3, 5]);
    expect(x[0]).toBeCloseTo(0.8, 12);
    expect(x[1]).toBeCloseTo(1.4, 12);
  });
});

describe('live series', () => {
  it('stay bounded and keep their last point', () => {
    const s = new Series('x', 16);
    for (let i = 0; i < 1000; i++) s.push(i, i * i);
    expect(s.length).toBeLessThanOrEqual(17);
    expect(s.points[s.points.length - 1]).toEqual([999, 999 * 999]);
    expect(s.points[0]).toEqual([0, 0]);
  });

  it('trials keep the running mean, its standard error and the expected mean', () => {
    const t = new Trials('m', 'e');
    for (const [m, e] of [[2, 3], [4, 3], [6, 3]]) t.add(m, e);
    expect(t.mean).toBe(4);
    expect(t.expected).toBe(3);
    expect(t.stderr).toBeCloseTo(Math.sqrt(4 / 3), 12);
    expect(t.measured.points).toEqual([[1, 2], [2, 3], [3, 4]]);
  });

  it('a power fit recovers the exponent of exact power data', () => {
    const fit = powerFit([2, 4, 8, 16, 32].map((n) => [n, 3 * n ** 2.5] as [number, number]));
    expect(fit.k).toBeCloseTo(2.5, 10);
    expect(fit.c).toBeCloseTo(3, 8);
  });
});

describe('seeded inputs', () => {
  it('run seeds are reproducible 32-bit numbers and inputs follow them', () => {
    const s = Array.from({ length: 50 }, (_, k) => runSeed(77, k));
    expect(s.every((x) => Number.isInteger(x) && x >= 0 && x < 2 ** 32)).toBe(true);
    expect(new Set(s).size).toBe(50);
    expect(runSeed(77, 3)).toBe(s[3]);
    expect(input('random', 6, s[0])).toEqual(input('random', 6, s[0]));
  });
});
