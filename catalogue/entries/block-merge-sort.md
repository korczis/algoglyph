---
id: block-merge-sort
title: Block merge sort
taxonomy: sorting/mergesort
status: planned
engine: array
labs:
  - sorting
sources:
  - id: kim-2008
    ref: ratio-based stable in-place merging
  - id: huang-1992
    ref: stable merging in constant extra space
  - id: mcfadden-2014
    ref: reference implementation and write-up
tags:
  - sorting
  - merging
  - stable
  - in-place
  - blocks
complexity: n log n in every case; extra space 1
related:
  - in-place-merge-sort
---

A stable mergesort with constant extra space: merge two neighbouring sorted runs A and B inside the array by cutting A into blocks, threading the blocks through B to roughly where they belong, and merging each block locally with the keys of B that follow it.

The trick that makes it possible without an auxiliary array is a small set of mutually distinct keys pulled out of the input to serve as an internal buffer and as tags that keep blocks with equal keys in order. At the end the buffer is sorted and returned, which preserves stability. Kim and Kutzner's merge of runs of lengths m ≤ n uses O(m log(n/m + 1)) comparisons and a linear number of moves, and log n bottom-up levels give n log n in every case.

Start with Random permutation at n = 256: the auxiliary strip stays empty, and blocks move by rotations and exchanges inside the array. Then try Few distinct keys, where gathering enough distinct keys for the buffer is hardest, which is one of the cases a real implementation must handle along with unequal run lengths and a last partial block.

It is the method of choice when stability, a guaranteed n log n and constant memory are all required at once, a combination ordinary mergesort cannot offer. WikiSort and GrailSort are its best-known implementations.
