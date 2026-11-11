---
id: mergesort-bottom-up
title: Mergesort, bottom-up
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - mergesort
  - stable
  - iterative
  - auxiliary memory
complexity: at most n lg n compares, n extra space
related:
  - mergesort-top-down
---

Merge runs of 1, then 2, 4, 8 and so on across the whole array, without recursion.

Each pass sweeps the whole array once, doubling the run length, so the passes are visible as waves of merges of growing width.
