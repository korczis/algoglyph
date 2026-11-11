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
complexity: n lg n compares, n²/4 moves
---

Insertion sort that finds each insertion point by binary search.

Comparisons drop to about n lg n, but every key still has to be moved one place at a time, so the writes stay quadratic: compare the two counters with plain insertion sort.
