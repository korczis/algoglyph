---
id: library-sort
title: Library sort
taxonomy: sorting/elementary
status: live
engine: array
labs:
  - sorting
sources:
  - id: bender-2006
    ref: the journal version and its analysis
  - id: bender-2004
    ref: the original preprint
  - id: knuth-taocp-3
    ref: "5.2.1 Sorting by insertion"
tags:
  - sorting
  - insertion
  - gaps
  - online
complexity: n log n with high probability; extra space (1 + ε) n
related:
  - binary-insertion-sort
  - insertion-sort
  - two-way-insertion-sort
---

Gapped insertion sort: keep the sorted keys in an array about (1 + ε) n long with empty slots scattered between them, find each new key's place by binary search, and shift only as far as the nearest gap.

A librarian leaves room on the shelf so that a new book does not move the whole row; Bender, Farach-Colton and Mosteiro took that observation literally. The gaps are used up, so the algorithm works in rounds: after 1, 2, 4, 8 and further powers of two insertions it spreads the keys out evenly again, a rebalancing that costs linear time in the keys inserted so far and O(n) over the whole run.

Their result, published under the title Insertion Sort is O(n log n), is that each insertion costs O(log n) with high probability, so the whole sort runs in O(n log n) with high probability. That is a probabilistic guarantee, not a deterministic one, and binary search alone makes even the best case n log n comparisons. Start with Random permutation at n = 128 and watch the auxiliary strip: short shifts that stop at a nearby gap, and the periodic respreading.

Older insertion methods with extra memory, such as two-way insertion, cut the shifts only by a constant factor; library sort is the one that reaches the optimal growth. It is mainly a theoretical point, since simpler n log n sorts give deterministic bounds without the extra array, and the cited sources do not settle its stability.
