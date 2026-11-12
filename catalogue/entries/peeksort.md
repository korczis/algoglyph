---
id: peeksort
title: Peeksort
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: munro-wild-2018
    ref: the original description
  - id: juge-2020
    ref: the n(H + 3) merge-cost bound
  - id: peters-2002
    ref: why CPython chose powersort instead
tags:
  - sorting
  - merging
  - stable
  - adaptive
  - runs
complexity: n best, n log n average and worst; extra space n
related:
  - adaptiveshiverssort
  - mergesort-natural
  - mergesort-top-down
  - powersort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [mergesort-top-down, powersort]
  objectives:
  - 'Count Already sorted: 2(n − 1) comparisons and no write, the first run scanned from the left and the last from the right, here the same run.'
  - 'Count Reversed at 512 keys: n runs of one key, since only weakly ascending runs count, and ½ n lg n + n = 2,816 comparisons.'
  - 'Compute H of the weakly ascending runs and check the comparisons against 2(n − 1) + n(H + 2).'
  misconceptions:
  - 'Peeksort finds descending runs as Timsort does; it takes only weakly ascending runs, so Reversed is n runs of one key and costs ½ n lg n + n comparisons where powersort needs n − 1.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes, a copy one) and auxiliary writes (the shorter run, copied for each merge)'
  best: '2(n − 1) comparisons and no writes (Already sorted, keys all equal)'
  average: 'comparisons ≤ 2(n − 1) + n(H + 2), H the entropy of the weakly ascending run lengths (merge cost, Munro and Wild); Reversed at a power of two ½ n lg n + n comparisons, n lg n array writes and ½ n lg n auxiliary writes'
  worst: 'O(n log n) comparisons, since H ≤ lg n'
claims:
  - id: reversed-is-n-runs
    statement: >-
      On Reversed at 512 keys peeksort sees n runs of one key and makes ½ n lg n + n = 2,816 comparisons, where powersort, which reverses a descending run, needs 511.
    readout: Comparisons
    expect: { value: 2816 }
    setup:
      params: { shape: reversed, n: 512 }
---

Top-down mergesort that peeks before it splits: instead of cutting the range exactly in half, it cuts at the run boundary nearest the middle, sorts both sides recursively and merges them, so a range that is already a single run is left alone.

The recursion becomes an approximate balanced merge tree over the natural runs: the boundary in the middle is merged last, shorter stretches earlier, and a run that lies inside one side is never split. A blind split in half would cut through runs and add work. Start with Organ pipe at n = 256, which has one boundary near the middle, and compare its merge traffic with mergesort-top-down on the same input.

Merge cost is measured as the total length of everything merged and compared with nH, where H is the entropy of the run lengths; nH is a lower bound for every stable natural mergesort. Peeksort's cost is at most n(H + 3), a slightly weaker guarantee than powersort's n(H + 2). Since H ≤ log₂ n the worst case is n log n, and on Already sorted the whole array is one run, recognised in linear time.

It suits code that already has a recursive mergesort and wants it run-adaptive without a stack of runs and merge rules. Libraries that scan left to right and handle each run as it is found prefer powersort, its bottom-up sibling, which is what CPython adopted.
