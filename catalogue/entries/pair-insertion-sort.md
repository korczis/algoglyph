---
id: pair-insertion-sort
title: Pair insertion sort
taxonomy: sorting/elementary
status: live
engine: array
labs:
  - sorting
sources:
  - id: yaroslavskiy-2011
    ref: the OpenJDK implementation, its documented source
  - id: knuth-taocp-3
    ref: "5.2.1 Sorting by insertion"
  - id: wild-2015
    ref: analysis of Java's dual-pivot quicksort
tags:
  - sorting
  - insertion
  - quadratic
  - in-place
  - adaptive
complexity: n best, n² average and worst; extra space 1
related:
  - binary-insertion-sort
  - dual-pivot-quicksort
  - insertion-sort
---

Insertion sort that takes the unsorted keys two at a time: order the pair, insert the larger one by shifting the run two places at once, then continue leftwards with the smaller one, shifting one place.

The stretch of the sorted run to the right of the larger key is read and rewritten once instead of twice, which is the whole saving. Start with Random permutation at n = 32: the writes readout shows the double-distance shifts, and comparing it with insertion sort on the same keys in the lab makes the constant factor visible.

Every inversion still has to be removed, so the number of moves stays proportional to the inversions: quadratic on average and in the worst case, linear on Already sorted. It works in place, but it is not stable: when the two keys of a pair are equal, the first is treated as the larger and inserted first, so the pair comes out reversed. The OpenJDK code that documents it sorts arrays of primitive values, where that does not matter.

It is documented only as the small-subarray step of Java's dual-pivot quicksort, which uses it on every part except the leftmost, where a key of the neighbouring part serves as a sentinel; the leftmost part is sorted by plain insertion. Who devised it is not recorded, and there is no peer-reviewed analysis of pair insertion on its own; the analyses of the dual-pivot quicksort treat it only as part of the whole.
