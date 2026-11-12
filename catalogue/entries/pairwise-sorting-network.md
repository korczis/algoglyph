---
id: pairwise-sorting-network
title: Pairwise sorting network
taxonomy: sorting/networks
status: planned
engine: array
labs:
  - sorting
sources:
  - id: parberry-1992
    ref: the original construction and its size and depth
  - id: knuth-taocp-3
    ref: "5.3.4 Networks for sorting"
  - id: ajtai-1983
    ref: the asymptotically shallower network
tags:
  - sorting
  - sorting network
  - oblivious
  - in-place
  - parallel
  - zero-one principle
complexity: n log² n in every case; extra space 1
related:
  - batcher-merge-exchange
  - bitonic-sort
---

Parberry's network turns Batcher's order around: first sort neighbouring pairs, then pairs of pairs and so on, and only then repair the result with comparators at shrinking distances.

After the pairs are sorted, the smaller and the larger members of the pairs form two sequences that can be sorted independently; once both are sorted, the array is nearly in order and a final phase of comparators between different pairs removes what is left. Parberry derived the construction from the zero-one principle and proved that it has exactly the size and the depth of Batcher's odd-even merge network.

The plate runs each parallel round as a sequence of disjoint comparators and counts the total work, which is on the order of n log² n compare-exchanges for every input; the depth, the parallel time, is on the order of log² n. Start with Random permutation at n = 64 and watch the long-distance repairs of the second phase; then compare the counts in the lab with Batcher's merge exchange and bitonic sort.

It saves no comparators over Batcher's network, so its value is the result itself: a quite different route, from sorting pairs and putting them into lexicographic order, reaches the same optimum. The network of Ajtai, Komlós and Szemerédi has asymptotically smaller depth, on the order of log n. Like every comparator network it is in place and not stable.
