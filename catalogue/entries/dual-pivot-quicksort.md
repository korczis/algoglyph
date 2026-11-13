---
id: dual-pivot-quicksort
title: Quicksort, dual pivot
taxonomy: sorting/quicksort
status: live
engine: array
labs:
  - sorting
sources:
  - id: yaroslavskiy-2011
    ref: the OpenJDK implementation
  - id: oracle-2011
    ref: java.util.Arrays, sorting of primitive arrays
  - id: wild-2012
    ref: average-case analysis
  - id: wild-2015
    ref: distributional analysis and the instruction-count puzzle
  - id: aumuller-2015
    ref: optimal dual-pivot partitioning
  - id: musser-1997
    ref: the heapsort fallback of introsort
tags:
  - sorting
  - quicksort
  - partitioning
  - in-place
  - multiple pivots
complexity: n log n best, n log n average, n² worst; extra space log n
motivation: Java 7 adopted it for sorting arrays of primitive values.
related:
  - multi-pivot-quicksort
  - quicksort
  - quicksort-three-way
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [quicksort, quicksort-three-way]
  objectives:
  - 'Name the three parts one scan produces, keys below p, between p and q and above q, and where both pivots land.'
  - 'Below 17 keys count insertion sort alone: at n = 8 or 16 the Array writes are twice the inversions.'
  - 'Explain why both pivots being the two smallest keys of every subarray make the comparisons quadratic.'
  misconceptions:
  - 'Two pivots remove the quadratic worst case; with both pivots the two smallest keys of every subarray it costs more than n²/4 comparisons.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons and array writes (an exchange is two writes)'
  best: 'linear: 2(n − 1) comparisons and 8 array writes when all keys are equal, from 17 keys on: one partition, its middle part skipped'
  average: '~1.9 n ln n comparisons on random permutations for Yaroslavskiy''s partition (Wild and Nebel); below 17 keys insertion sort alone, with array writes = 2 × inversions and inversions ≤ comparisons ≤ inversions + n − 1'
  worst: 'quadratic: more than n²/4 comparisons from 65 keys on, when both pivots are the two smallest keys of every subarray'
claims:
  - id: insertion-up-to-16-keys
    statement: >-
      At 16 keys dual-pivot quicksort never partitions: on Reversed its insertion by exchanges makes 2 × inversions = n(n − 1) = 240 array writes.
    readout: Array writes
    expect: { value: 240 }
    setup:
      params: { shape: reversed, n: 16 }
---

Choose two pivots p ≤ q and partition in one scan into keys below p, keys between p and q, and keys above q; both pivots land in their final places and the three parts are sorted recursively.

Yaroslavskiy's partition keeps three indices: one bounding the keys below p, one bounding the keys above q, and a scanning index between them. The kernel takes the tertile keys as pivots, skips the middle part when the two pivots are equal, and hands subarrays shorter than 17 keys to insertion sort, as in the original description; the later Java tuning is left out.

On random permutations the analysed variant needs about 1.9 n ln n comparisons against classic quicksort's 2 n ln n, but more exchanges, and counted at the level of Java bytecode it executes slightly more instructions, which contradicts the measured speed; the explanation has to be sought beyond operation counts. Aumüller and Dietzfelbinger showed that no dual-pivot partition can average fewer than 1.8 n ln n + O(n) comparisons.

Start with Random permutation at n = 128 next to single-pivot quicksort in the lab, then with Few distinct keys, where the equal-pivot shortcut matters. The worst case is still quadratic and partitioning still moves keys over equal ones, so it is not stable; a hard guarantee needs a fallback such as introsort's heapsort.
