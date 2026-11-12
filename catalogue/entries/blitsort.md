---
id: blitsort
title: Blitsort
taxonomy: sorting/hybrid
status: planned
engine: array
labs:
  - sorting
sources:
  - id: vandenhoven-2021-blitsort
    ref: reference implementation and its README
  - id: vandenhoven-2021-fluxsort
    ref: the method it adapts
tags:
  - sorting
  - hybrid
  - stable
  - in-place
  - adaptive
  - rotations
complexity: n best, n log n average and worst; extra space log n
related:
  - crumsort
  - fluxsort
  - in-place-merge-sort
  - quadsort
  - symmerge-based-sort
---

Fluxsort without the big buffer: a stable quicksort and mergesort hybrid that makes do with a small fixed buffer and solves everything that does not fit with rotations of adjacent blocks.

A rotation exchanges two neighbouring blocks while keeping the order inside each, so it preserves stability where an exchange of single keys would not. The rotating merge takes the middle key of the first run, binary-searches the second run for the keys below it, rotates, and recurses until the pieces are small enough to merge through the buffer; the stable partition works segment by segment through the buffer and then rotates the pieces into place.

The analyser is Fluxsort's: sorted and reversed input finish at once, mostly sorted stretches go to a rotating quadsort, the rest to a rotating Fluxsort. Start with Random permutation at n = 256 and compare its counters with Fluxsort's on the same input: the difference is what giving up the large buffer costs in moves.

The bounds in the author's table count comparisons only; the cost of the moves made by rotations is not analysed, and there is no peer-reviewed analysis. Recursion needs log n stack, which an explicit stack could reduce further.
