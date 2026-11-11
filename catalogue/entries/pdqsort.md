---
id: pdqsort
title: Pattern-defeating quicksort
taxonomy: sorting/quicksort
status: planned
engine: array
labs:
  - sorting
sources:
  - id: peters-2021
    ref: the description and analysis
  - id: peters-2015
    ref: the reference implementation
  - id: musser-1997
    ref: the introsort depth limit it inherits
  - id: edelkamp-2016
    ref: the block partition of its branchless variant
  - id: go-2022
    ref: adoption in Go's sort package
tags:
  - sorting
  - quicksort
  - partitioning
  - in-place
  - adaptive
  - hybrid
complexity: n best, n log n average and worst; extra space log n
motivation: Go's standard sort package has used it since Go 1.19.
related:
  - blockquicksort
  - heapsort
  - insertion-sort
  - quicksort
  - quicksort-three-way
  - randomized-quicksort
---

Introsort extended: quicksort with a median-of-three pivot and insertion sort for short subarrays, plus three guards — break patterns that produce bad pivots, fall back to heapsort after too many bad partitions, and filter out keys equal to the pivot.

A partition is bad when the pivot lands in the outer eighth of the subarray. Then a few keys at fixed positions are exchanged to break the pattern, and after more than log n bad partitions the subarray is finished by heapsort, which bounds the worst case at n log n. The shuffle uses fixed positions, not randomness, so a run is deterministic.

Run Already sorted and Reversed at n = 256. A partition that moved nothing triggers an optimistic insertion sort that gives up after a few moves; on sorted input it never has to give up, and the whole sort is linear. Then try Few distinct keys: when a new pivot equals the pivot of the parent partition nothing smaller can be in the subarray, so every key equal to it is filtered out in one pass, a new answer to the Dutch national flag problem without three-way comparisons.

The kernel ports the branching variant of the reference code, with Tukey's ninther as the pivot above 128 keys; the branchless block partition borrowed from BlockQuicksort is not included. It is not stable. Rust's earlier sort_unstable was largely a port of it, and ipnsort is its successor.
