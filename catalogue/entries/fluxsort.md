---
id: fluxsort
title: Fluxsort
taxonomy: sorting/hybrid
status: live
engine: array
labs:
  - sorting
sources:
  - id: vandenhoven-2021-fluxsort
    ref: reference implementation and its README
  - id: edelkamp-2016
    ref: branchless partitioning
  - id: hoare-1962
    ref: the partitioning step
tags:
  - sorting
  - hybrid
  - stable
  - adaptive
  - stable quicksort
  - branchless
complexity: n best, n log n average and worst; extra space n
related:
  - blockquicksort
  - glidesort
  - pdqsort
  - quadsort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [quicksort, binary-insertion-sort]
  objectives:
  - 'Run Already sorted: the first scan makes n − 1 comparisons, finds the keys in order, and nothing else runs.'
  - 'Below 25 keys count the scan up to the first descent, then a binary insertion sort, and no auxiliary write.'
  - 'Compare Organ pipe with Random permutation at 512 keys: 11,352 comparisons in 225 phases against 4,528, more than twice as many.'
  misconceptions:
  - 'A quicksort costs n log n comparisons even on sorted input; fluxsort''s first scan finishes Already sorted with n − 1 comparisons and no write.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons, array writes (copies: each partition writes the smaller keys to the front and the rest back from the buffer; the insertion sort shifts) and auxiliary writes (the swap buffer, each cell that changes)'
  best: 'n − 1 comparisons and no write on Already sorted and on keys all equal'
  average: 'up to 24 keys the scan to the first descent and then a binary insertion sort, counted exactly, with no auxiliary write'
claims:
  - id: sorted-finishes-in-the-scan
    statement: >-
      On Already sorted at 512 keys fluxsort makes n − 1 = 511 comparisons: its first scan finds the keys in order, and nothing else runs.
    readout: Comparisons
    expect: { value: 511 }
    setup:
      params: { shape: sorted, n: 512 }
---

A stable quicksort: partition top-down around a pivot, copying the keys smaller than the pivot to the front of the array and the others to an auxiliary buffer, both in their original order, then copying the buffer back behind them; small ranges are finished by binary insertion.

Stability comes from never exchanging keys across long distances: each key is copied once per partition into the side it belongs to, so equal keys keep their order. The cost is an auxiliary buffer of n keys, which the readouts count as auxiliary traffic.

In the author's repository an analyser runs first: it finishes sorted and reversed input in n comparisons, measures how presorted each quarter of the array is, and gives mostly sorted quarters to quadsort; large ranges take their pivot from a sample near the cube root of the range, and when one side ends up smaller than a sixteenth of the other, both sides go to quadsort. The kernel keeps only the first test, a scan that finishes Already sorted in n − 1 comparisons; Reversed is partitioned like any other input. Its pivot is a pseudo-median of nine above 64 keys and a median of three below, a pivot no larger than the previous one splits off the keys equal to it, which are then final, and ranges of at most 24 keys are finished by binary insertion instead of quadsort. Start with Already sorted at n = 256 to see the scan alone, then Random permutation to see the partitioning.

All of this is documented only in the author's repository: the bounds in its table count comparisons, and there is no peer-reviewed analysis. The branchless partitioning it builds on is the idea Edelkamp and Weiß introduced with BlockQuicksort.
