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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - insertion-sort
  objectives:
  - 'Watch the larger key of each pair shift the run two places at once, then the smaller one continue one place at a time.'
  - 'Count 3⌊(n − 1)/2⌋ comparisons, one more for even n, and 2⌊(n − 1)/2⌋ array writes on Already sorted: each pair is ordered, then both keys are written back.'
  - 'Compare the writes with insertion sort on the same keys in the lab.'
  misconceptions:
  - 'Pair insertion is stable like straight insertion; an equal pair comes out reversed.'
algorithm:
  paradigm: incremental
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons and array writes (a shift is one write)'
  best: '3⌊(n − 1)/2⌋ comparisons, one more when n is even, and 2⌊(n − 1)/2⌋ array writes (Already sorted)'
  worst: 'O(n²) comparisons and array writes'
claims:
  - id: sorted-three-per-pair
    statement: >-
      On Already sorted at 128 keys pair insertion sort makes 3⌊(n − 1)/2⌋ + 1 = 190 comparisons: three for each of the 63 pairs it inserts, and one more because n is even.
    readout: Comparisons
    expect: { value: 190 }
    setup:
      params: { shape: sorted, n: 128 }
---

Insertion sort that takes the unsorted keys two at a time: order the pair, insert the larger one by shifting the run two places at once, then continue leftwards with the smaller one, shifting one place.

The stretch of the sorted run to the right of the larger key is read and rewritten once instead of twice, which is the whole saving. Start with Random permutation at n = 32: the writes readout shows the double-distance shifts, and comparing it with insertion sort on the same keys in the lab makes the constant factor visible.

Every inversion still has to be removed, so the number of moves stays proportional to the inversions: quadratic on average and in the worst case, linear on Already sorted. It works in place, but it is not stable: when the two keys of a pair are equal, the first is treated as the larger and inserted first, so the pair comes out reversed. The OpenJDK code that documents it sorts arrays of primitive values, where that does not matter.

It is documented only as the small-subarray step of Java's dual-pivot quicksort, which uses it on every part except the leftmost, where a key of the neighbouring part serves as a sentinel; the leftmost part is sorted by plain insertion. Who devised it is not recorded, and there is no peer-reviewed analysis of pair insertion on its own; the analyses of the dual-pivot quicksort treat it only as part of the whole.
