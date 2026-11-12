---
id: crumsort
title: Crumsort
taxonomy: sorting/hybrid
status: live
engine: array
labs:
  - sorting
sources:
  - id: vandenhoven-2022-crumsort
    ref: reference implementation and its README
  - id: hoare-1962
    ref: the partitioning it modifies
  - id: edelkamp-2016
    ref: branchless partitioning
tags:
  - sorting
  - hybrid
  - in-place
  - adaptive
  - branchless
complexity: n best, n log n average and worst; extra space log n
related:
  - blockquicksort
  - fluxsort
  - pdqsort
  - quadsort
  - quicksort
---

The in-place, unstable sibling of Fluxsort: the same analyser, the same pivot selection and the same hand-off of small or presorted ranges to quadsort, but partitioning in place with what its author calls a fulcrum partition.

The fulcrum partition resembles Hoare's, except that it works with a one-key gap instead of exchanges: the pivot's value is held aside, and each misplaced key is written into the gap, which then moves to where that key came from. Two assignments replace the three of an exchange. Start with Random permutation at n = 256 and compare the write counter with quicksort's.

Pivots are a pseudo-median of nine, a median of sixteen or the median of a random sample, depending on the size of the range. Against runaway recursion, both sides go to quadsort when one is smaller than a sixteenth of the other; the author argues that this and the analyser make killer patterns unlikely, but there is no peer-reviewed analysis of these claims.

Being unstable, it breaks existing patterns and adapts less than Fluxsort; in exchange it needs no buffer of size n. The branchless idea it uses comes from BlockQuicksort, which partitions in a Hoare-like way rather than with a fulcrum.
