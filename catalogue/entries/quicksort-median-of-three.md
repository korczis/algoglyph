---
id: quicksort-median-of-three
title: Quicksort, median-of-three with cutoff
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
  - median of three
  - insertion cutoff
complexity: about 1.19 n lg n compares on average
related:
  - quicksort
  - insertion-sort
---

The pivot is the median of the first, middle and last keys; small subfiles are left for one final insertion sort.

Sorting the three sample keys also places sentinels at both ends of the subfile, so the partitioning scans need no bounds checks.

Watch the end of the run: the array is nearly sorted in blocks of up to ten keys, and a single insertion pass finishes it.
