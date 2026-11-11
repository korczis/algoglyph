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
---

Insertion sort on keys h apart, for h = …, 40, 13, 4, 1: Knuth's increments.

Each h-sort moves keys far in few steps, so the final 1-sort (plain insertion sort) finds almost nothing left to do.

The measured growth exponent in the lab is the honest test of an increment sequence: there is no proof of its average case.
