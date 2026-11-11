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
---

Take each key in turn and slide it left into the sorted prefix.

Larger keys move one place right to make room, so the work is the number of inversions: Nearly sorted finishes almost at once, Reversed is the worst case.

Equal keys never pass each other, so it is stable; it is the sort quicksort and mergesort hand their small subfiles to.
