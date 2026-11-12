---
id: sort-tapestry
title: Sort Tapestry
taxonomy: sorting/overview
status: live
engine: custom
sources:
  - id: knuth-taocp-3
  - id: cormen-2022
tags:
  - sorting
  - generators
  - permutations
complexity: see the algorithm
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - 'Choose Radix LSD, base 4, at 96 values per row: 0 comparisons / row and 384 writes / row, one pass of n writes per base-4 digit of n − 1, four at 96.'
  - 'Choose Selection at 96 values per row: 4,560 comparisons / row, n(n − 1)/2 on every row, and at most 2(n − 1) writes.'
  misconceptions:
  - 'Every sort compares keys; radix sort sorts every row with no comparison at all, only writes.'
claims:
  - id: radix-writes-one-pass-per-digit
    statement: >-
      With Radix LSD, base 4, at 96 values per row the tapestry reads 384 writes per row once every row is sorted: four passes of 96 writes, one per base-4 digit of 95, and no comparison.
    readout: writes / row
    expect: { value: 384 }
    setup:
      params: { algorithm: radix, n: 96 }
---

Every row is its own shuffled spectrum, sorted in lockstep by one algorithm: its fingerprint is woven into the cloth.

Each row holds a permutation of n values coloured along the palette. All rows run the same algorithm from different shuffles, advancing the same number of operations per frame.

Quadratic sorts drift like sand; quicksort tears the cloth into blocks; heapsort first arranges the heap, a rough slope from the largest values at the left edge, then peels it from the right; radix never compares at all and sorts by base-4 digit, one pass per digit: four passes from 65 values up to 256, three at 64.

The readout counts comparisons and writes exactly as the generators perform them, averaged over the rows.
