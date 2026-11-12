---
id: shellsort-sedgewick
title: Shellsort, Sedgewick increments
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
complexity: O(n^(4/3)) worst case
related:
  - shellsort-knuth
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - shellsort-knuth
  objectives:
  - 'Run the insertion passes of the 3h + 1 sequence with the increments 1, 8, 23, 77, 281, … and compare the counters on one input in the lab.'
  - 'Count Σ(n − h) comparisons over its increments h < n and no writes on Already sorted.'
algorithm:
  paradigm: iterative-refinement
bounds:
  model: 'comparisons and array writes (a shift is one write)'
  best: 'Σ (n − h) comparisons over the increments h < n, and no writes (Already sorted)'
  worst: 'O(n^(4/3)) comparisons'
---

Shellsort with the increments 1, 8, 23, 77, 281, … = 4^k + 3·2^(k−1) + 1.

The same insertion passes as 3h + 1, with a sequence whose worst case is provably lower; compare their counters on the same input in the lab.
