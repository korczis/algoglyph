---
id: randomized-quicksort
title: Quicksort, random pivot
taxonomy: sorting/quicksort
status: live
engine: array
labs:
  - sorting
sources:
  - id: cormen-2022
    ref: "Chapter 7: Quicksort"
  - id: motwani-1995
    ref: the expected-comparisons analysis
  - id: hoare-1962
    ref: the suggestion to choose the pivot at random
  - id: musser-1997
    ref: the deterministic alternative
tags:
  - sorting
  - quicksort
  - partitioning
  - in-place
  - randomized
complexity: n log n best, n log n average, n² worst; extra space log n
related:
  - quicksort
  - quicksort-three-way
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [quicksort]
  objectives:
  - 'Count Already sorted at 512 keys: close to the 4,946 comparisons a random input expects, where the rightmost pivot needs 131,838.'
  - 'Read the comparisons as m − 1 for every partition of m keys, so that no run makes more than n(n − 1)/2.'
  - 'Try Few distinct keys and watch the keys equal to the pivot pile up on its left in every partition.'
  misconceptions:
  - 'A random pivot makes quicksort n log n on every input; with all keys equal every seed costs n(n − 1)/2 comparisons.'
algorithm:
  paradigm: randomized
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons and array writes (an exchange is two writes)'
  best: 'at least (n + 1)⌊lg(n + 1)⌋ − 2^(⌊lg(n + 1)⌋ + 1) + 2 comparisons on every input and seed, the cost when every split is as even as it can be'
  average: '2(n + 1)H_n − 4n ≈ 1.39 n lg n expected comparisons on every input of distinct keys'
  worst: 'n(n − 1)/2 comparisons and (n − 1)(n + 4) array writes, at most on every input and seed, and exactly that when all keys are equal, whatever the seed'
claims:
  - id: sorted-input-near-the-random-figure
    statement: >-
      On Already sorted at 512 keys the random pivot keeps the comparisons within 1,000 (about
      three standard deviations of the count over seeds) of the 2(n + 1)H_n − 4n ≈ 4,946 a
      random input expects; the rightmost pivot needs 131,838 there.
    readout: Comparisons
    expect: { value: 4946, tolerance: 1000 }
    setup:
      params: { shape: sorted, n: 512, speed: 2000 }
---

Quicksort with one change: the pivot is drawn uniformly at random from the subarray being partitioned, swapped to its end, and the usual partition follows.

The change moves the randomness from the input into the algorithm. A fixed pivot rule has inputs that make it quadratic; with a random pivot every fixed input has an expected cost of about 2n ln n comparisons, and a bad run is bad luck in the draws, not bad data. The analysis is short: the i-th and j-th smallest keys are compared exactly when one of them is the first pivot drawn among the keys between them, which happens with probability 2/(j − i + 1).

Run it on Already sorted and Reversed at n = 128, the inputs that wreck the rightmost-pivot quicksort, and the comparison count stays near the random-input figure. The generator is seeded, so a run can be repeated exactly.

Hoare already recommended a random pivot in 1962. Randomness does not help with equal keys: with Few distinct keys a two-way partition still does needless work, which three-way partitioning removes. When a deterministic worst-case guarantee is required, introsort caps the recursion depth and falls back to heapsort instead.
