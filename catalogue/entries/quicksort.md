---
id: quicksort
title: Quicksort
taxonomy: sorting/quicksort
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - quicksort
  - partitioning
  - divide and conquer
  - in-place
complexity: 1.39 n lg n compares on average, n²/2 worst case
schema: algoglyph.entry/v2
aliases:
  - Partition-exchange sort
relations:
  - { type: compares_with, target: mergesort-top-down, reason: "Same problem: n log n on average, but in place and unstable against stable with auxiliary memory." }
  - { type: compares_with, target: heapsort, reason: "Both in place; heapsort never goes quadratic, quicksort usually runs faster." }
pedagogy:
  difficulty: intermediate
  prerequisites: [insertion-sort]
  objectives:
    - Partition a subfile around a pivot and say where the pivot ends up.
    - Explain why a bad pivot makes the comparisons quadratic.
  misconceptions:
    - Quicksort is always n log n; with this pivot rule sorted input is its worst case.
  questions:
    - Why does sorting the smaller side first keep the stack small?
algorithm:
  paradigm: divide-and-conquer
  properties: { stable: false, in_place: true, comparison_based: true, deterministic: true, adaptive: false }
  postconditions:
    - The array is ascending and a permutation of the input.
  invariants:
    - After a partition, no key left of the pivot is larger and no key right of it is smaller.
  limitations:
    - The rightmost key is the pivot, so sorted and reversed input degrade to n²/2 comparisons.
bounds:
  model: key comparisons
  best: ~n lg n
  average: ~2n ln n ≈ 1.39 n lg n
  worst: ~n²/2
  space: O(lg n) pending subfiles, smaller side first
experiments:
  - { id: sorted-input, title: Already sorted, params: { shape: sorted, n: 128 }, observe: "Every partition peels off one key: count the comparisons against the random case." }
  - { id: duplicates, title: Few distinct keys, params: { shape: few-unique, n: 128 }, observe: "Equal keys keep being partitioned; compare with three-way quicksort in the lab." }
---

Partition around the rightmost key, then sort the two sides.

The shaded band is the subfile being partitioned; the smaller side is sorted first, which keeps the pending stack logarithmic.

Already sorted and Reversed input make the rightmost key a terrible pivot: the bands shrink by one and the comparisons go quadratic. Median-of-three cures exactly this.
