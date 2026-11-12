---
id: introsort
title: Introsort
taxonomy: sorting/hybrid
status: planned
engine: array
labs:
  - sorting
sources:
  - id: musser-1997
    ref: the original description
  - id: hoare-1962
    ref: the partitioning step
  - id: kristo-2021
    ref: the C++ std::sort hybrid, as summarised
tags:
  - sorting
  - hybrid
  - in-place
  - introspection
  - worst-case guarantee
complexity: n log n in every case; extra space log n
motivation: The C++ standard library's std::sort is this kind of hybrid of quicksort, insertion sort and heapsort.
related:
  - blockquicksort
  - heapsort
  - insertion-sort
  - ipnsort
  - pdqsort
  - quicksort
  - quicksort-median-of-three
  - randomized-quicksort
  - skasort
  - spreadsort
---

Quicksort that watches itself: it counts the depth of its own recursion, and when the depth passes a bound proportional to log n it hands the current subarray to heapsort; small subarrays are left for one final pass of insertion sort.

Musser's point was that median-of-three pivots do not protect quicksort: some inputs still drive it to quadratic time. Introsort keeps quicksort's speed on typical data, where the depth bound is never reached, and inherits heapsort's n log n bound on the inputs that would otherwise go quadratic.

The pivot is the median of the first, middle and last keys, the partition is Hoare's, and the depth counter starts at twice ⌊lg n⌋ and drops by one per partitioning level. Start with Random permutation at n = 256: the plate should look exactly like quicksort with a cutoff, followed by a sweep of insertion sort that finds almost nothing to do, because the array is already nearly sorted. On typical input the depth bound is never reached; when an input does exhaust it, the subarray it was working on is sorted by heapsort instead.

Introsort is in place and not stable, since both partitioning and the heap reorder equal keys, and it gains nothing from presorted input. When stability matters, a mergesort or Timsort fits better; when presorted runs matter, pdqsort keeps the same guarantee and adapts to them.
