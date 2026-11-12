---
id: external-quicksort
title: External quicksort
taxonomy: sorting/external
status: planned
engine: array
labs:
  - sorting
sources:
  - id: vitter-2008
    ref: distribution sorts and their pass counts
  - id: aggarwal-1988
    ref: the I/O model and its bound
  - id: cormen-2022
    ref: "Chapter 7: Quicksort"
  - id: vitter-1994
    ref: distribution over parallel disks
tags:
  - sorting
  - external sorting
  - partitioning
  - quicksort
complexity: n log n comparisons on average, n² worst; about log₂(N/M) passes; extra space n
related:
  - external-merge-sort
  - quicksort
---

Hoare's partitioning carried over to files: one sequential pass splits the file around a pivot into smaller and larger parts, and each part is split again until it fits in memory and is sorted there.

Comparisons behave as in quicksort, n log n on average and n² with persistently bad pivots, but on disk the passes are what costs. A single pivot splits into at most two parts, so even perfect pivots need about log₂(N/M) levels, each a full pass over the data. A distribution sort that splits into a number of parts growing with M/B needs only log_{M/B}(N/B) passes; with room for a thousand blocks that logarithm is about ten times smaller.

The plate partitions the array with a small memory holding the middle group, shown in the auxiliary strip, and counts element operations; passes are the model in these notes. Start with Random permutation at n = 256 and count the levels of splitting before every part fits in memory: on disk each unbalanced level is another expensive pass, not just more comparisons.

No single original paper, author or year can be documented; in the external-memory literature it serves as the baseline that multiway distribution improves on. It makes sense when memory holds only a few blocks, and as a lesson in why two-way splitting wastes the memory that could hold many output buffers. It is neither stable nor in place on disk.
