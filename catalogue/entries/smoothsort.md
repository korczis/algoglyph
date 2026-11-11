---
id: smoothsort
title: Smoothsort
taxonomy: sorting/priority-queues
status: live
engine: array
labs:
  - sorting
sources:
  - id: dijkstra-1981
    ref: the manuscript EWD 796a
  - id: dijkstra-1982
    ref: the journal version
  - id: bron-1991
    ref: Smoothsort revisited
  - id: williams-1964
    ref: heapsort, which it adapts
  - id: levcopoulos-1989
    ref: another adaptive heap sort
tags:
  - sorting
  - heap
  - priority queue
  - in-place
  - adaptive
  - leonardo numbers
complexity: n best, n log n average and worst; extra space 1
related:
  - heapsort
  - insertion-sort
---

Dijkstra's answer to heapsort's blindness to order: keep a forest of heaps whose sizes are Leonardo numbers, with each root at the right end of its stretch and the roots ascending, so the maximum always sits at the far right where it can stay.

Heapsort spends n log n even on a sorted array. Smoothsort was designed to cost n on an input that is already (nearly) sorted, n log n in the worst case, and to move smoothly between the two, which is where its name comes from. The stretch sizes follow L(k + 2) = L(k + 1) + L(k) + 1: 1, 1, 3, 5, 9, 15, 25, 41 and so on, and a tree of one size splits into two trees of the two sizes below it.

The array grows a forest from the left: a new key either merges the two last stretches, when their sizes are neighbouring Leonardo numbers, or starts a stretch of size 1; it then moves left among the roots and sifts down. Shrinking peels the maximum off the right and splits its tree. On ascending input none of these moves does any work, which is the linear best case.

Try Nearly sorted at n = 128 and then Random permutation at the same size: the comparison counter shows the smooth transition the design promises. It sorts in place with a constant number of words of bookkeeping and is not stable. In practice its intricate code and heapsort-like memory access keep it rare; adaptive mergesorts such as Timsort usually win on nearly sorted data, but they need extra memory and smoothsort does not.
