---
id: ips4o
title: In-place parallel super scalar samplesort (IPS⁴o)
taxonomy: sorting/parallel
status: planned
engine: array
labs:
  - sorting
sources:
  - id: axtmann-2022
    ref: the extended description, analysis and benchmarks
  - id: axtmann-2017
    ref: the original description
  - id: sanders-2004
    ref: the branchless classification tree
tags:
  - sorting
  - parallel
  - in-place
  - samplesort
  - branchless
complexity: n log n in every case (with high probability); extra space log n
related:
  - blockquicksort
  - learnedsort
  - parallel-samplesort
  - pdqsort
  - samplesort
---

A recursive samplesort that splits the input into k buckets per level, in place and in parallel: elements go into small per-bucket buffers, full buffers are written back over slots already read, and whole blocks are then permuted into their buckets.

Each level has four phases. A sample gives the splitters and a classification tree; every worker classifies its stretch into k buffers of b elements and flushes each full buffer back into the array; the blocks are permuted to the bucket regions whose sizes are now known; a cleanup fixes the partial blocks at bucket boundaries. Buckets recurse, and small ones finish by insertion sort. The tree that assigns an element to its bucket is computed without conditional branches, an idea taken from super scalar samplesort.

The plate runs the workers' steps one after another and counts their total work; the parallel speed-up is described by the authors, not shown. Start with Random permutation at n = 256 and watch the array fill with blocks in bucket order before the recursion tidies each bucket. Already sorted is worth a run too: the authors' implementation detects it and stops after one pass, a heuristic rather than adaptivity.

The n log n bound holds with high probability for any input, not deterministically. Extra space is a few buffers and k blocks per worker, which the authors count as in place because they define in place as at most logarithmic extra memory. It is not stable; its out-of-place sibling PS⁴o is. In the authors' experiments it beat the other comparison sorts they measured on multicore machines and stayed competitive with the best quicksorts when run on a single thread.
