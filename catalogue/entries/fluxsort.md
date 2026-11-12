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
---

A stable quicksort: partition top-down around a pivot, copying keys not larger than the pivot to the front of the array and larger keys to an auxiliary array, both in their original order; small or presorted ranges go to the quadsort mergesort.

Stability comes from never exchanging keys across long distances: each key is copied once per partition into the side it belongs to, so equal keys keep their order. The cost is an auxiliary buffer of n keys, which the readouts count as auxiliary traffic.

An analyser runs first. It finishes sorted and reversed input in n comparisons, measures how presorted each quarter of the array is, and gives mostly sorted quarters to quadsort. Pivots are a quasi-median of nine for small ranges and the median of a sample near the cube root of the range for large ones; if one side ends up smaller than a sixteenth of the other, both sides go to quadsort. Start with Nearly sorted at n = 256 to see the analyser at work, then Random permutation to see the partitioning.

All of this is documented only in the author's repository: the bounds in its table count comparisons, and there is no peer-reviewed analysis. The branchless partitioning it builds on is the idea Edelkamp and Weiß introduced with BlockQuicksort.
