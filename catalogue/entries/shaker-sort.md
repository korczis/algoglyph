---
id: shaker-sort
title: Cocktail shaker sort
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
  - bidirectional
  - in-place
complexity: n²/2 compares worst case
related:
  - bubble-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites:
  - bubble-sort
  objectives:
  - 'Watch both ends of the band move to the last exchange of their pass, so a turtle travels left in a single backward pass.'
  - 'Read the Array writes as twice the inversions, exactly as in bubble sort; only the comparisons change.'
  - 'Count n − 1 comparisons on Already sorted and n(n − 1)/2 on Reversed.'
  misconceptions:
  - 'Shaking in both directions saves exchanges; each exchange still removes one inversion, and only comparisons are saved.'
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
  - id: sorted-one-pass
    statement: >-
      On Already sorted at 128 keys cocktail shaker sort makes n − 1 = 127 comparisons and no write: the first pass exchanges nothing and ends the sort.
    readout: Comparisons
    expect: { value: 127 }
    setup:
      params: { shape: sorted, n: 128 }
---

Bubble sort that alternates direction, so small keys travel left as fast as large keys travel right.

The band shrinks from both ends, each end moving to the last exchange it saw. Organ pipe input shows the turtles it rescues.
