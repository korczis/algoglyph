---
id: wikisort
title: WikiSort
taxonomy: sorting/mergesort
status: planned
engine: array
labs:
  - sorting
sources:
  - id: mcfadden-2014
    ref: reference implementation and documentation
  - id: kim-2008
    ref: the stable in-place merge it builds on
tags:
  - sorting
  - merging
  - stable
  - in-place
  - adaptive
  - blocks
complexity: n best, n log n average and worst; extra space 1
related:
  - block-merge-sort
  - grailsort
  - in-place-merge-sort
  - mergesort-bottom-up
---

A bottom-up block mergesort that is stable and uses O(1) extra memory, built on Kim and Kutzner's ratio-based stable in-place merge, with cheap checks that skip merges the data does not need.

Before merging neighbouring runs A and B it tests two easy cases: if the last key of A is not greater than the first key of B the runs are already in order and nothing happens; if all of B is smaller than A the runs are swapped by one rotation. Only otherwise does it block-merge, threading blocks of A through B with a buffer of distinct keys taken from the input. Try Already sorted at n = 256: every level passes its check and the run costs a linear number of comparisons.

The documentation states O(1) memory and stability but no running time. The n log n average and worst cases follow from the linear stable in-place merge and the log n levels of bottom-up merging; the linear best case follows from the checks in the source, not from a published result. The author benchmarks it against std::stable_sort with a fixed 512-element buffer, which keeps memory constant, and reports the largest gains on ascending, nearly sorted and constant inputs.

Compare Random permutation with Nearly sorted at the same n to see how much the skip checks save. There is no peer-reviewed analysis of the implementation itself, so the lab's measured growth is the honest account of its cost.
