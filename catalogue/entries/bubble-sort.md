---
id: bubble-sort
title: Bubble sort
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
  - in-place
complexity: n²/2 compares worst case
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - 'Count n − 1 comparisons and no writes on Already sorted, where the first pass makes no exchange and the run stops.'
  - 'Read the Array writes as twice the inversions of the input: each exchange of neighbours removes exactly one.'
  - 'Watch a small key near the right end, a turtle, move only one place per pass.'
  misconceptions:
  - 'The early exit makes bubble sort competitive; it helps only on nearly sorted input, and elsewhere insertion sort is faster.'
algorithm:
  paradigm: iterative-refinement
  properties:
    stable: true
    in_place: true
bounds:
  model: 'comparisons and array writes (an exchange is two writes)'
  best: 'n − 1 comparisons and no writes (Already sorted)'
  average: 'on every input, array writes = 2 × inversions'
  worst: 'n(n − 1)/2 comparisons and n(n − 1) array writes (Reversed)'
claims:
  - id: reversed-writes-twice-the-inversions
    statement: >-
      On Reversed at 128 keys bubble sort makes 2 × inversions = n(n − 1) = 16,256 array writes: each of the 8,128 inversions is removed by one exchange of two writes.
    readout: Array writes
    expect: { value: 16256 }
    setup:
      params: { shape: reversed, n: 128 }
---

Exchange neighbours that are out of order, pass after pass, until a pass changes nothing.

Each pass carries the largest remaining key to the end of the band; small keys near the end ("turtles") move only one place per pass.

The early exit makes it linear on sorted input, and it is still slower than insertion sort on everything else.
