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
---

Quicksort with one change: the pivot is drawn uniformly at random from the subarray being partitioned, swapped to its end, and the usual partition follows.

The change moves the randomness from the input into the algorithm. A fixed pivot rule has inputs that make it quadratic; with a random pivot every fixed input has an expected cost of about 2n ln n comparisons, and a bad run is bad luck in the draws, not bad data. The analysis is short: the i-th and j-th smallest keys are compared exactly when one of them is the first pivot drawn among the keys between them, which happens with probability 2/(j − i + 1).

Run it on Already sorted and Reversed at n = 128, the inputs that wreck the rightmost-pivot quicksort, and the comparison count stays near the random-input figure. The generator is seeded, so a run can be repeated exactly.

Hoare already recommended a random pivot in 1962. Randomness does not help with equal keys: with Few distinct keys a two-way partition still does needless work, which three-way partitioning removes. When a deterministic worst-case guarantee is required, introsort caps the recursion depth and falls back to heapsort instead.
