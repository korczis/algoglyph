---
id: parallel-quicksort
title: Quicksort, parallel
taxonomy: sorting/parallel
status: live
engine: array
labs:
  - sorting
sources:
  - id: sanders-2019
    ref: "Chapter 5: Sorting and Selection"
  - id: cormen-2022
    ref: "Chapter 7: Quicksort"
tags:
  - sorting
  - parallel
  - in-place
  - quicksort
complexity: n log n best, n log n average, n² worst; extra space log n
related:
  - parallel-merge-sort
  - parallel-samplesort
  - quicksort
  - randomized-quicksort
---

Quicksort with the partitioning shared among workers: the group agrees on a random pivot, every worker partitions its own share, the counts of the two sides decide how many workers take each side, and both subgroups recurse.

Launching only the recursive calls in parallel leaves the first partition of the whole array sequential, which caps the speed-up. Partitioning in parallel is easier than merging, but it raises a load-balancing question: the pivot never splits exactly in half, so the workers must be divided between the sides in proportion. A group of one finishes with sequential quicksort.

The plate runs the workers' steps one after another and counts total work: order n log n comparisons on average and n² with persistently bad pivots, as for sequential quicksort. Start with Random permutation at n = 128, then try Few distinct keys to see how unequal sides become. In the distributed version the recursion depth is of order log p with high probability, and the time is of order (n/p) log n + log² p, the second term coming from the broadcasts and prefix sums at every level.

The weak spot is balance: rounding the number of workers compounds over the levels, so small groups are better served by a pivot chosen from a large sample or by switching to samplesort, which is quicksort with p − 1 pivots at once. It is not stable; the shared-memory version works almost in place with a recursion stack, and on many distributed processors samplesort, which exchanges the data only once, is usually faster.
