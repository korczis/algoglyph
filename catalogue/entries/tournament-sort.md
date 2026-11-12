---
id: tournament-sort
title: Tournament sort
taxonomy: sorting/priority-queues
status: live
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "5.2.3 Sorting by selection (tree selection)"
  - id: cormen-2022
    ref: "Chapter 6: Heapsort"
tags:
  - sorting
  - heap
  - priority queue
  - tree selection
complexity: n log n in every case; extra space n
related:
  - heapsort
  - replacement-selection
  - selection-sort
---

A knockout tournament: the keys are players at the leaves of a binary tree, every inner node holds the winner (the smaller key) of its two children, and the champion at the root is the minimum; output it, replace its leaf with infinity, and replay only the matches on its path.

That replay is the whole point. Straight selection searches for every minimum from scratch with a linear scan; the tournament remembers the results of earlier matches, so after the first tournament of n − 1 comparisons each further minimum costs only as many comparisons as the tree has levels. In total that is about n log n comparisons on every input, because the tournament is played the same way whatever the order.

The winner tree needs room for its inner nodes and the output usually goes to a separate array, so the extra space is linear; heapsort reaches the same n log n inside the array itself, and in memory it wins. Start with Random permutation at n = 64 and set it against selection sort in the lab: the gap between their comparison counts is the value of remembered matches.

Whether equal keys keep their input order depends on the tie rule: if a tie always goes to the key from the left, the sort is stable, otherwise it is not. Tournament trees matter most outside in-memory sorting, as the selection step of multiway merging and of replacement selection in external sorting.
