---
id: binary-insertion-sort
title: Binary insertion sort
taxonomy: sorting/elementary
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - quadratic
  - stable
  - binary search
  - in-place
complexity: n lg n compares, n²/4 moves
related:
  - insertion-sort
  - binary-search
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites:
  - insertion-sort
  - binary-search
  objectives:
  - 'Find each insertion point by binary search and watch the Comparisons readout fall far below insertion sort''s on the same input.'
  - 'See the Array writes stay those of insertion sort, the inversions plus the keys that move, because every larger key still shifts one place.'
  - 'Count Σ(⌊lg i⌋ + 1) comparisons on Reversed, where every binary search runs its full length.'
  misconceptions:
  - 'Binary search makes insertion sort n log n; it cuts only the comparisons, and the writes stay quadratic.'
algorithm:
  paradigm: incremental
  properties:
    stable: true
    in_place: true
bounds:
  model: 'comparisons and array writes (a shift is one write)'
  best: 'no array writes on Already sorted, and never fewer than Σ_{i=1}^{n−1} ⌊lg i⌋ comparisons'
  average: 'on every input, array writes = inversions + keys that move'
  worst: 'Σ_{i=1}^{n−1} (⌊lg i⌋ + 1) comparisons and n(n − 1)/2 + n − 1 array writes, both on Reversed'
claims:
  - id: reversed-takes-the-top
    statement: >-
      On Reversed at 128 keys binary insertion sort makes Σ (⌊lg i⌋ + 1) = 769 comparisons over i = 1 … 127, the top of its range: every binary search runs its full length.
    readout: Comparisons
    expect: { value: 769 }
    setup:
      params: { shape: reversed, n: 128 }
---

Insertion sort that finds each insertion point by binary search.

Comparisons drop to about n lg n, but every key still has to be moved one place at a time, so the writes stay quadratic: compare the two counters with plain insertion sort.
