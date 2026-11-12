---
id: shellsort-knuth
title: Shellsort, 3h + 1 increments
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
  - shellsort
  - in-place
  - increments
complexity: O(n^(3/2)) worst case for this sequence
related:
  - insertion-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - insertion-sort
  objectives:
  - 'Watch each h-sort move keys h places at a time, leaving the final 1-sort little to do.'
  - 'Count Σ(n − h) comparisons over the increments h < n and no writes on Already sorted.'
  - 'Measure the growth of the counters in the lab, the honest test of an increment sequence.'
  misconceptions:
  - 'The average case of the 3h + 1 sequence is proved; there is no proof of it, only of the worst case.'
algorithm:
  paradigm: iterative-refinement
  properties:
    in_place: true
bounds:
  model: 'comparisons and array writes (a shift is one write)'
  best: 'Σ (n − h) comparisons over the increments h < n, and no writes (Already sorted)'
  worst: 'O(n^(3/2)) comparisons'
---

Insertion sort on keys h apart, for h = …, 40, 13, 4, 1: Knuth's increments.

Each h-sort moves keys far in few steps, so the final 1-sort (plain insertion sort) finds almost nothing left to do.

The measured growth exponent in the lab is the honest test of an increment sequence: there is no proof of its average case.
