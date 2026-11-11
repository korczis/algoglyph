// Every live array kernel of the catalogue, checked by one harness: a kernel added to the
// catalogue is tested without a line of test code (ADR 0004 §4).
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../src/core/catalogue';
import { input, inversions, SHAPES, trace, type ArrayKernel } from '../src/engines/array/trace';

const modules = import.meta.glob<ArrayKernel>('../src/kernels/array/[!_]*.ts', { import: 'kernel', eager: true });
const live = ENTRIES.filter((e) => e.engine === 'array' && e.status === 'live');
const kernelOf = (id: string) => modules[`../src/kernels/array/${id}.ts`];
const SIZES = [0, 1, 2, 3, 7, 16, 61, 128];

describe('array kernels', () => {
  it('every live array entry has its kernel and every kernel its entry', () => {
    const files = Object.keys(modules).map((f) => f.replace(/^.*\/(.*)\.ts$/, '$1')).sort();
    expect(files).toEqual(live.map((e) => e.id).sort());
  });

  for (const e of live) {
    const kernel = kernelOf(e.id);
    describe(e.id, () => {
      it('leaves every input shape and size in the order its goal promises', () => {
        for (const shape of SHAPES) {
          for (const n of SIZES) {
            const data = input(shape, n, 1000 + n);
            const k = Math.floor(n / 2);
            const t = trace(kernel, data, k);
            expect(t.truncated).toBe(false);
            const want = data.slice().sort((x, y) => x - y);
            expect(t.output.slice().sort((x, y) => x - y), `${shape} n=${n} is a permutation`).toEqual(want);
            if (kernel.goal === 'select') {
              if (n) expect(t.output[k], `${shape} n=${n} rank ${k}`).toBe(want[k]);
            } else {
              expect(t.output, `${shape} n=${n}`).toEqual(want);
            }
          }
        }
      });

      if (e.tags.includes('stable') && !e.tags.includes('non-comparison')) {
        it('keeps equal keys in their input order (stable)', () => {
          // value = key * 1000 + original position; the order compares keys only
          const keys = input('few-unique', 97, 7);
          const data = keys.map((k, i) => k * 1000 + i);
          const t = trace(kernel, data, 0, undefined, (x, y) => Math.floor(x / 1000) < Math.floor(y / 1000));
          for (let i = 1; i < t.output.length; i++) {
            const [a, b] = [t.output[i - 1], t.output[i]];
            if (Math.floor(a / 1000) === Math.floor(b / 1000)) expect(a % 1000).toBeLessThan(b % 1000);
          }
        });
      }

      if (e.tags.includes('non-comparison')) {
        it('makes no key comparison', () => {
          expect(trace(kernel, input('random', 200, 3)).counts.compares).toBe(0);
        });
      }
    });
  }
});

describe('array kernels against independent counts', () => {
  const n = 64;
  const run = (id: string, shape: (typeof SHAPES)[number] = 'random') => trace(kernelOf(id), input(shape, n, 11));

  it('selection sort compares n(n-1)/2 times whatever the input', () => {
    for (const shape of SHAPES) expect(run('selection-sort', shape).counts.compares).toBe((n * (n - 1)) / 2);
  });

  it('insertion sort moves each key once per inversion', () => {
    const data = input('random', n, 11);
    const t = trace(kernelOf('insertion-sort'), data);
    // every inversion is one shift; each key that moves is written once more into its slot
    const moved = data.filter((_, i) => data.slice(0, i).some((x) => x > data[i])).length;
    expect(t.counts.writes).toBe(inversions(data) + moved);
  });

  it('top-down mergesort stays within n lg n comparisons', () => {
    expect(run('mergesort-top-down').counts.compares).toBeLessThanOrEqual(n * Math.log2(n));
  });

  it("Batcher's network compares the same pairs on every input", () => {
    const counts = SHAPES.map((s) => run('batcher-merge-exchange', s).counts.compares);
    expect(new Set(counts).size).toBe(1);
  });

  it('three-way quicksort beats two-way quicksort on few distinct keys', () => {
    expect(run('quicksort-three-way', 'few-unique').counts.compares)
      .toBeLessThan(run('quicksort', 'few-unique').counts.compares);
  });

  it('natural mergesort is linear on sorted input', () => {
    expect(run('mergesort-natural', 'sorted').counts.compares).toBe(n - 1);
  });
});
