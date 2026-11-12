---
id: comb-sort
title: Comb sort
taxonomy: sorting/elementary
status: live
engine: array
labs:
  - sorting
sources:
  - id: dobosiewicz-1980
    ref: the original proposal
  - id: knuth-taocp-3
    ref: "5.2.2 Sorting by exchanging"
  - id: sedgewick-1996
    ref: h-bubble variants among Shellsort's relatives
tags:
  - sorting
  - exchange
  - gaps
  - in-place
complexity: n log n best, average unknown, n² worst; extra space 1
related:
  - bubble-sort
  - shaker-sort
  - shellsort-knuth
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - bubble-sort
  objectives:
  - 'Watch long exchanges across a wide gap give way to short ones as the gap shrinks by the factor 1.3.'
  - 'Count on Already sorted one pass of n − g comparisons per gap g and no writes at all.'
  - 'Count the passes in the Phase readout, one per gap, and the extra passes at gap 1 that the final bubble phase needs.'
  misconceptions:
  - 'The shrink factor 1.3 is an analysed optimum; it is a common empirical choice.'
algorithm:
  paradigm: iterative-refinement
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes) and passes (the Phase readout)'
  best: 'no writes on Already sorted, and n − g comparisons for each gap g = ⌊10g/13⌋ from g = n down to 1'
  average: 'unknown (no analysis)'
  worst: 'O(n²), from the passes with gap 1'
---

Bubble sort over keys a gap apart: compare and exchange pairs h positions away, shrink h by a constant factor after each pass, and finish with ordinary bubble passes once h reaches 1.

The gap exists for the turtles. Bubble sort moves a small key near the right end one place per pass; one exchange across a gap of h removes many inversions at once, the same idea Shellsort applies with full insertion sorts at each gap. Start with Random permutation at n = 64 and watch the long early exchanges give way to short ones.

The shrink factor 1.3 that most implementations use is a common choice, not an analysed result. Passes with a gap above 1 are logarithmic in number, so Already sorted costs on the order of n log n comparisons and no exchanges; the quadratic upper bound comes only from the final bubble phase.

There is no known average-case analysis: Sedgewick's survey lists variants that replace each h-sort with a single bubble-type pass among the relatives of Shellsort whose average behaviour is known only from experiments. Exchanges across a gap can jump over an equal key, so comb sort is not stable; compare it in the lab against both bubble sort and Shellsort to place it between them.
