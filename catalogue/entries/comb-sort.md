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
---

Bubble sort over keys a gap apart: compare and exchange pairs h positions away, shrink h by a constant factor after each pass, and finish with ordinary bubble passes once h reaches 1.

The gap exists for the turtles. Bubble sort moves a small key near the right end one place per pass; one exchange across a gap of h removes many inversions at once, the same idea Shellsort applies with full insertion sorts at each gap. Start with Random permutation at n = 64 and watch the long early exchanges give way to short ones.

The shrink factor 1.3 that most implementations use is a common choice, not an analysed result. Passes with a gap above 1 are logarithmic in number, so Already sorted costs on the order of n log n comparisons and no exchanges; the quadratic upper bound comes only from the final bubble phase.

There is no known average-case analysis: Sedgewick's survey lists variants that replace each h-sort with a single bubble-type pass among the relatives of Shellsort whose average behaviour is known only from experiments. Exchanges across a gap can jump over an equal key, so comb sort is not stable; compare it in the lab against both bubble sort and Shellsort to place it between them.
