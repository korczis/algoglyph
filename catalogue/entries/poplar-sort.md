---
id: poplar-sort
title: Poplar sort
taxonomy: sorting/priority-queues
status: live
engine: array
labs:
  - sorting
sources:
  - id: bron-1991
    ref: Smoothsort revisited, where poplars are defined
  - id: morwenn-2017
    ref: reference implementation and its notes
  - id: dijkstra-1981
    ref: smoothsort, which it simplifies
tags:
  - sorting
  - heap
  - priority queue
  - in-place
complexity: n log n in every case; extra space log n
related:
  - heapsort
  - smoothsort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [smoothsort]
  objectives:
  - 'Run Already sorted: no array write, and ½ n lg n comparisons when n is a power of two, 2,304 at 512 keys.'
  - 'Compare with smoothsort on Already sorted: 448 comparisons against 477 at 128 keys, 2,304 against 2,007 at 512.'
  - 'Explain why every removal scans the roots of all poplars, and why that rules out a linear best case.'
  misconceptions:
  - 'Giving up smoothsort''s ordered roots makes it the dearer on sorted input at every size; at 128 keys it needs fewer comparisons than smoothsort on Already sorted and on Nearly sorted, and its root scans overtake only on larger inputs.'
algorithm:
  paradigm: incremental
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons and array writes (every write is half of an exchange)'
  best: 'Already sorted and keys all equal: no write, and ½ n lg n comparisons when n is a power of two, so not linear'
  worst: 'O(n log n) comparisons'
claims:
  - id: sorted-half-n-lg-n
    statement: >-
      On Already sorted at 512 keys poplar sort makes ½ n lg n = 2,304 comparisons, where smoothsort makes 2,007.
    readout: Comparisons
    expect: { value: 2304 }
    setup:
      params: { shape: sorted, n: 512, speed: 2000 }
---

A simplified smoothsort: build a forest of poplars, perfect binary heaps of size 2^k − 1 stored with their two sub-poplars first and the root last, and repeatedly move the largest root to the end of the array.

Bron and Hesselink defined the poplar in their revisit of smoothsort. A poplar heap is a sequence of poplars from larger on the left to smaller on the right, each as large as possible, so a dozen keys become poplars of sizes 7, 3, 1 and 1; at most the two rightmost can share a size. Adding a key joins the two last poplars when they are equal in size and sifts the new root down, otherwise it starts a poplar of its own.

Unlike smoothsort, the roots are not kept in order, so every removal scans the roots of all poplars to find the maximum. That keeps the code simple and costs the linear best case: even an input that is already a valid poplar heap pays a logarithmic root scan for each key. Compare it with smoothsort on Already sorted: at 128 keys the poplar sort needs fewer comparisons, 448 against 477, at 512 keys more, 2,304 against 2,007, and on Nearly sorted at 128 keys it is again the cheaper, 462 against 499. What the simplification gives up is the order of growth, and the root scans overtake smoothsort's linear best case only on larger inputs.

The reference implementation is explicitly a demonstration of the idea, and its author notes that operations on a poplar heap are slow next to an ordinary binary heap. For practical in-place sorting with a guaranteed n log n, heapsort and its variants are the better tools. It sorts in place and is not stable.
