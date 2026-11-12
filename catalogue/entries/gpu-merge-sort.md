---
id: gpu-merge-sort
title: Mergesort on a GPU
taxonomy: sorting/parallel
status: planned
engine: array
labs:
  - sorting
sources:
  - id: satish-2009
    ref: the original GPU design and measurements
  - id: green-2012
    ref: merge path
  - id: sanders-2019
    ref: "Chapter 5: Sorting and Selection"
tags:
  - sorting
  - parallel
  - gpu
  - merging
complexity: n log n in every case; extra space n
related:
  - gpu-bitonic-sort
  - gpu-radix-sort
  - mergesort-top-down
  - parallel-merge-sort
---

Two phases: every block of threads sorts its tile in fast on-chip memory, then sorted runs are merged in pairs, round after round, with every merge cut into many equal, independent pieces so that thousands of threads stay busy even when only a few long runs remain.

The cut comes from merge path. Merging A and B is a path through an |A| × |B| grid that steps right when it takes from A and down when it takes from B; diagonals across the grid divide the output into equal lengths, and a binary search finds where the path crosses each one. Every thread then merges exactly the same number of elements, whatever the data.

The plate runs the threads' merges one after another and counts total work: order n log n comparisons in every case, plus a binary search of order log n per piece. Start with Random permutation at n = 256 and watch the tiles become sorted first, then the runs double. Extra space is linear, one output buffer per round; it is stable as a variant, when ties go to the left run and the cuts follow the same rule.

At publication the 2009 design was the fastest comparison sort reported, slower than its sibling GPU radix sort but usable for any key with a comparison function. That is when to reach for it: variable-length keys, composite records, custom orders or a stable comparison sort; for fixed-length keys radix sort is usually faster.
