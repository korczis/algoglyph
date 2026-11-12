---
id: gpu-radix-sort
title: Radix sort on a GPU
taxonomy: sorting/parallel
status: planned
engine: array
labs:
  - sorting
sources:
  - id: satish-2009
    ref: the original GPU design and measurements
  - id: merrill-2011
    ref: faster fused-kernel variants
  - id: zagha-1991
    ref: the vector-multiprocessor predecessor
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
tags:
  - sorting
  - parallel
  - stable
  - non-comparison
  - gpu
  - radix
complexity: d (n + k) in every case; extra space n + p k
related:
  - gpu-bitonic-sort
  - lsd-radix-sort
  - parallel-radix-sort
---

Parallel LSD radix sort shaped for a graphics processor: the input is cut into tiles, one block of threads per tile; in every digit pass a block sorts its tile by the digit in fast on-chip memory, writes a histogram, a global prefix sum over all histograms (by digit, then by block) gives each block its write positions, and the block scatters its elements there.

The basic operation is the parallel prefix sum, the scan: it computes both the positions inside a tile and the global offsets. Sorting each tile locally first puts the elements with equal digits next to each other, so the writes to global memory are contiguous. The design rests on fine-grained parallelism, independent tasks with little global communication, and on-chip memory.

The plate runs the blocks' steps one after another and counts total work, of order d(n + k) for d digits of k values plus the per-pass histograms and prefix sums; it never compares two keys. Start with Random permutation at n = 256 and follow one digit pass at a time through the auxiliary buffer. Every pass is stable, which LSD radix sort needs to be correct, so the whole sort is stable.

At publication the 2009 design was the fastest GPU sort reported, up to four times faster than the graphics-based GPUSort; fused-kernel variants published in 2011 sped it up further, past a billion 32-bit keys per second on one GPU. It is the choice for large arrays of fixed-length keys; keys of variable length or a custom comparison call for GPU mergesort instead.
