---
id: quicksort
title: Quicksort
taxonomy: sorting/quicksort
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - quicksort
  - partitioning
  - divide and conquer
  - in-place
complexity: 1.39 n lg n compares on average, n²/2 worst case
---

Partition around the rightmost key, then sort the two sides.

The shaded band is the subfile being partitioned; the smaller side is sorted first, which keeps the pending stack logarithmic.

Already sorted and Reversed input make the rightmost key a terrible pivot: the bands shrink by one and the comparisons go quadratic. Median-of-three cures exactly this.
