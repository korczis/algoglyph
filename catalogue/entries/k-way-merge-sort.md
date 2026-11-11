---
id: k-way-merge-sort
title: Mergesort, k-way
taxonomy: sorting/mergesort
status: planned
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "5.4.1 Multiway merging and replacement selection"
  - id: cormen-2022
    ref: "Chapter 6: Heapsort, the exercise on merging k sorted lists"
tags:
  - sorting
  - merging
  - stable
  - multiway
  - priority queue
complexity: n log n in every case; extra space n
related:
  - balanced-multiway-merge
  - binary-heap
  - heapsort
  - mergesort-top-down
  - patience-sorting
  - tournament-sort
---

Split the input into k parts, sort each recursively, then merge all k at once by repeatedly taking the smallest of the k front keys from a priority queue.

Finding the minimum of k candidates by scanning would cost k − 1 comparisons per key; a binary heap or a tournament tree of the fronts costs about log k. Merging k sorted lists of n keys in total therefore takes O(n log k), and with log_k n levels of recursion the total is n log n comparisons, the same order as two-way mergesort. What k buys is fewer passes over the data: log_k n instead of log₂ n.

That saving matters where a pass is expensive, which is why Knuth treats multiway merging chiefly as the heart of external sorting on tapes and discs, with a selection tree finding the minimum. In memory, on small inputs, the heap's overhead per comparison usually makes it slower than two-way merging. Start with Random permutation at n = 256 and watch the merges: each output key comes out of a small heap of fronts rather than a pairwise comparison.

The split ignores the data, so it is not adaptive, and the merge output needs n keys of extra space. It is stable when ties in the heap go to the earlier part, since the parts are contiguous runs of the input in their original order.
