// Every exact count or hard inequality the searching wing's hash and custom entries state in a
// bound (catalogue/entries/*.md, ADR 0006 §4), driven at several n and compared with what the
// plate or kernel counts. Expected bounds (about, expected, O) are not checked here; the hash
// kernels' expected formulas are compared with measured runs, within tolerances, by
// test/kernels-hash.test.ts ("measured probes on uniform keys lie near its formula at half load",
// "pages on uniform keys lie near n / (b ln 2)"). Exact bounds already proved elsewhere:
//   binary-search, never more than ⌊lg n⌋ + 1 probes: test/plates-custom.test.ts
//   ("binary search probes at most ⌊lg n⌋ + 1 times, inside its interval"); attainment below
//   sequential-search, a hit at position i costs i probes and a miss all n:
//   test/plates-custom.test.ts ("sequential search finds what indexOf finds ...")
//   indexed-sequential-access, at most ⌊lg P⌋ + 1 index comparisons and 1 + c page reads:
//   test/plates-custom.test.ts ("finds exactly the stored keys after inserts into overflow chains")
//   separate-chaining, a miss compares its whole chain and a hit the keys up to its own:
//   test/kernels-hash.test.ts ("takes exactly the probes a recount from the final table predicts")
//   dynamic-hash-table, load factor between 1/8 and 1/2 once grown: test/kernels-hash.test.ts
//   ("keeps the load factor between 1/8 and 1/2 after every resize")
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { KIND, OP, STRIDE, trace, type Step } from '../src/engines/hash/table';
import { keys } from '../src/engines/hash/workload';
import { kernel as extendible } from '../src/kernels/hash/extendible-hashing';
import { Isam } from '../src/plates/indexed-sequential-access/isam';
import { binarySearch, sortedKeys } from '../src/plates/_shared/sorted-search/search';

describe('searching (hash and custom plates): exact bounds against counted runs', () => {
  it('binary-search: the worst search, hit or miss, takes exactly ⌊lg n⌋ + 1 probes', () => {
    const rnd = mulberry32(21);
    for (const n of [1, 2, 3, 7, 8, 9, 100, 255, 256, 1000]) {
      const a = sortedKeys(n, 'uniform', rnd);
      const bound = Math.floor(Math.log2(n)) + 1;
      let worstHit = 0;
      let worstMiss = 0;
      for (const k of a) worstHit = Math.max(worstHit, binarySearch(a, k).probes.length);
      // every gap: below the first key, between neighbours, above the last
      const gaps = [a[0] - 1, ...a.slice(1).map((k, i) => (a[i] + k) / 2), a[n - 1] + 1];
      for (const k of gaps) {
        const r = binarySearch(a, k);
        expect(r.index).toBe(-1);
        worstMiss = Math.max(worstMiss, r.probes.length);
      }
      expect(Math.max(worstHit, worstMiss), `n=${n}`).toBe(bound);
      expect(worstMiss, `n=${n}`).toBe(bound);
    }
  });

  it('indexed-sequential-access: one page read per search until an overflow chain forms', () => {
    const rnd = mulberry32(31);
    for (const n of [1, 10, 100, 480]) {
      for (const size of [4, 8, 16]) {
        const a = sortedKeys(n, 'uniform', rnd);
        const isam = new Isam(a, size, 0.75);
        const bound = Math.floor(Math.log2(isam.index.length)) + 1;
        for (let q = a[0] - 2; q <= a[n - 1] + 2; q++) {
          const r = isam.search(q);
          expect(r.pageReads).toBe(1);
          expect(r.indexProbes).toBeLessThanOrEqual(bound);
        }
      }
    }
  });

  it('extendible-hashing: one directory read, one page read and at most b keys compared', () => {
    for (const n of [1, 10, 100, 1000]) {
      for (const b of [4, 8, 16]) {
        const { inserted, absent } = keys('uniform', n, 50 + n + b);
        const steps: Step[] = [
          ...inserted.map((key) => ({ kind: KIND.insert, key }) as Step),
          ...[...inserted, ...absent].map((key) => ({ kind: KIND.search, key }) as Step),
        ];
        const t = trace(extendible, steps, { n, m: 1, pageSize: b });
        expect(t.truncated).toBe(false);
        let searches = 0;
        let kind = -1;
        let dirReads = 0;
        let loads = 0;
        let probes = 0;
        for (let e = 0; e < t.length; e++) {
          const o = STRIDE * e;
          const op = t.events[o];
          if (op === OP.begin) { kind = t.events[o + 1]; dirReads = 0; loads = 0; probes = 0; }
          else if (op === OP.dirRead) dirReads++;
          else if (op === OP.load) loads++;
          else if (op === OP.probe) probes++;
          else if (op === OP.end && kind === KIND.search) {
            searches++;
            expect(dirReads).toBe(1);
            expect(loads).toBe(1);
            expect(t.events[o + 4]).toBe(1);
            expect(t.events[o + 3]).toBe(probes);
            expect(probes).toBeLessThanOrEqual(b);
          }
        }
        expect(searches).toBe(inserted.length + absent.length);
      }
    }
  });
});
