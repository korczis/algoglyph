---
id: wikisort
title: WikiSort
taxonomy: sorting/mergesort
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [block-merge-sort]
  objectives:
  - 'Count Already sorted: n − 1 comparisons and no write, every merge skipped after one comparison.'
  - 'Count Reversed: no auxiliary write, every pair of runs exchanged by a rotation.'
  - 'Watch the Auxiliary writes on Random permutation: the merges go through a cache of 512 keys, 1,280 writes at 512 keys.'
  misconceptions:
  - 'Constant extra memory means no auxiliary writes; WikiSort''s fixed cache of 512 keys takes them, 1,280 on Random permutation at 512 keys.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes, a copy one) and auxiliary writes (the cache)'
  best: 'n − 1 comparisons and no writes (Already sorted, keys all equal), for every n up to 1,025'
  average: 'up to 16 keys insertion sort alone, with array writes = 2 × inversions and inversions ≤ comparisons ≤ inversions + n − 1; no auxiliary write on Reversed'
  worst: 'O(n log n): the linear stable in-place merge over the log n bottom-up levels'
claims:
  - id: sorted-skips-every-merge
    statement: >-
      On Already sorted at 512 keys WikiSort skips every merge after one comparison: n − 1 = 511 comparisons in all.
    readout: Comparisons
    expect: { value: 511 }
    setup:
      params: { shape: sorted, n: 512, speed: 2000 }
---

A bottom-up block mergesort that is stable and uses O(1) extra memory, built on Kim and Kutzner's ratio-based stable in-place merge, with cheap checks that skip merges the data does not need.

Before merging neighbouring runs A and B it tests two easy cases: if the last key of A is not greater than the first key of B the runs are already in order and nothing happens; if all of B is smaller than A the runs are swapped by one rotation. Only otherwise does it block-merge, threading blocks of A through B with a buffer of distinct keys taken from the input. Try Already sorted at n = 256: every level passes its check and the run costs a linear number of comparisons.

The documentation states O(1) memory and stability but no running time. The n log n average and worst cases follow from the linear stable in-place merge and the log n levels of bottom-up merging; the linear best case follows from the checks in the source, not from a published result. The author benchmarks it against std::stable_sort with a fixed 512-element buffer, which keeps memory constant, and reports the largest gains on ascending, nearly sorted and constant inputs.

Compare Random permutation with Nearly sorted at the same n to see how much the skip checks save. There is no peer-reviewed analysis of the implementation itself, so the lab's measured growth is the honest account of its cost.
