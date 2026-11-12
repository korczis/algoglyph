---
id: k-way-merge-sort
title: Mergesort, k-way
taxonomy: sorting/mergesort
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [mergesort-top-down, heapsort]
  objectives:
  - 'Read the Array writes: the same on every input, n for each level of the four-way split, 2,560 = 5n at 512 keys.'
  - 'Compare Random permutation at 512 keys with mergesort-top-down: 2,560 against 4,608 array writes, but more comparisons (4,964 against 3,988).'
  - 'Watch the Auxiliary writes: the heap of fronts and the output buffer.'
  misconceptions:
  - 'Merging more parts at once saves comparisons; it saves passes and writes, while every output key still needs the heap of fronts, so on Random permutation at 512 keys it compares more than two-way mergesort.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons, array writes (the merged output copied back) and auxiliary writes (the heap of fronts and the output buffer, each cell that changes)'
  average: 'the same array writes on every input of n keys, n per level of the four-way split: n⌈(lg n)/2⌉ when n is a power of two; O(n log n) comparisons (Knuth)'
claims:
  - id: writes-per-level
    statement: >-
      On Random permutation at 512 keys the Array writes are 5n = 2,560, n for each level of the four-way split and the same on every input, against 4,608 for two-way mergesort.
    readout: Array writes
    expect: { value: 2560 }
    setup:
      params: { shape: random, n: 512 }
---

Split the input into k parts, sort each recursively, then merge all k at once by repeatedly taking the smallest of the k front keys from a priority queue.

Finding the minimum of k candidates by scanning would cost k − 1 comparisons per key; a binary heap or a tournament tree of the fronts costs about log k. Merging k sorted lists of n keys in total therefore takes O(n log k), and with log_k n levels of recursion the total is n log n comparisons, the same order as two-way mergesort. What k buys is fewer passes over the data: log_k n instead of log₂ n.

That saving matters where a pass is expensive, which is why Knuth treats multiway merging chiefly as the heart of external sorting on tapes and discs, with a selection tree finding the minimum. In memory, on small inputs, the heap's overhead per comparison usually makes it slower than two-way merging. Start with Random permutation at n = 256 and watch the merges: each output key comes out of a small heap of fronts rather than a pairwise comparison.

The split ignores the data, so it is not adaptive, and the merge output needs n keys of extra space. It is stable when ties in the heap go to the earlier part, since the parts are contiguous runs of the input in their original order.
