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
---

Shellsort with the increments 1, 8, 23, 77, 281, … = 4^k + 3·2^(k−1) + 1.

The same insertion passes as 3h + 1, with a sequence whose worst case is provably lower; compare their counters on the same input in the lab.
