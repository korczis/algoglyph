---
id: insertion-sort
title: Insertion sort
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
  - adaptive
  - in-place
complexity: about n²/4 compares on random keys, n on sorted
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - 'Count n − 1 comparisons and no writes on Already sorted, and n(n − 1)/2 comparisons on Reversed.'
  - 'Read the Array writes as the inversions plus the keys that move: one shift per inversion and one write that drops each moved key into its slot.'
  - 'Watch Nearly sorted finish almost at once, since the work follows the inversions.'
  misconceptions:
  - 'Insertion sort is quadratic on every input; on nearly sorted input its work is close to linear.'
algorithm:
  paradigm: incremental
  properties:
    stable: true
    in_place: true
bounds:
  model: 'comparisons and array writes (a shift is one write)'
  best: 'n − 1 comparisons and no writes (Already sorted)'
  average: 'on every input, array writes = inversions + keys that move, and inversions ≤ comparisons ≤ inversions + n − 1'
  worst: 'n(n − 1)/2 comparisons and n(n − 1)/2 + n − 1 array writes (Reversed)'
---

Take each key in turn and slide it left into the sorted prefix.

Larger keys move one place right to make room, so the work is the number of inversions: Nearly sorted finishes almost at once, Reversed is the worst case.

Equal keys never pass each other, so it is stable; it is the sort quicksort and mergesort hand their small subfiles to.
