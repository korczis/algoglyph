---
id: quicksort-three-way
title: Quicksort, three-way partitioning
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
  - duplicate keys
  - dutch national flag
  - in-place
complexity: linear when the number of distinct keys is constant
related:
  - quicksort
---

Dijkstra's three-way partition into keys less than, equal to and greater than the pivot.

Keys equal to the pivot end up in the middle and are never touched again. Choose Few distinct keys: two-way quicksort keeps partitioning runs of equal keys, three-way finishes in a handful of passes.
