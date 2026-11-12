---
id: selection-sort
title: Selection sort
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
  - in-place
complexity: n²/2 compares, n − 1 exchanges
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - 'Count n(n − 1)/2 comparisons on every input, Already sorted included.'
  - 'See the Array writes stay at most 2(n − 1): at most one exchange per position, two writes each.'
  misconceptions:
  - 'Sorted input makes selection sort faster; it compares exactly as much, and only the writes drop to none.'
algorithm:
  paradigm: incremental
  properties:
    in_place: true
bounds:
  model: 'comparisons and array writes (an exchange is two writes)'
  best: 'n(n − 1)/2 comparisons and no writes (Already sorted)'
  average: 'on every input, n(n − 1)/2 comparisons'
  worst: 'n(n − 1)/2 comparisons and at most 2(n − 1) array writes'
---

Find the smallest remaining key and exchange it into place, left to right.

The shaded band is the unsorted remainder. Every pass scans all of it, so the number of comparisons does not depend on the input at all: try Already sorted and watch it work exactly as hard.

It makes at most n − 1 exchanges, fewer than any other sort here, which is why it still has a use when writes are expensive.
