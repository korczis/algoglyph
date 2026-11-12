---
id: gpu-bitonic-sort
title: Bitonic sort on a GPU
taxonomy: sorting/networks
status: live
engine: array
labs:
  - sorting
sources:
  - id: kipfer-2005
    ref: "chapter 46: Improved GPU Sorting"
  - id: batcher-1968
    ref: the bitonic network
  - id: satish-2009
    ref: comparison with GPU radix sort
  - id: sanders-2019
    ref: "Chapter 5: Sorting and Selection"
tags:
  - sorting
  - sorting network
  - oblivious
  - in-place
  - parallel
  - gpu
complexity: n log² n in every case; extra space 1
related:
  - batcher-merge-exchange
  - bitonic-sort
  - simd-sorting-network
---

Batcher's bitonic network run one layer at a time as a pass over the whole array: in every pass each thread takes one position, computes its partner from the position and the layer, compares the two keys and keeps the smaller or the larger according to the direction of its block.

Networks suit a GPU for two reasons. Their schedule does not depend on the data, so every thread does the same thing and the access pattern is known in advance. And early graphics processors could not choose where to write from the input values, which ruled out data-driven sorts such as quicksort, whereas a network always writes to a fixed position.

The plate runs the threads' compare-exchanges one after another and counts the total work: order n log² n comparisons on every input, exactly as the sequential bitonic network. For n = 2^k there are k(k + 1)/2 passes, the partner distance halving within each phase. The rounds in the readouts are the kernel launches, which are fewer: one sort of every tile of 32 keys in shared memory, then for every larger block size a global kernel for each layer whose partners lie in different tiles and one shared-memory kernel for the layers inside a tile. Start with Random permutation at n = 256, then run Already sorted and see the same number of comparisons.

The network itself works in place; early GPU implementations needed a second buffer only because they could not write into the texture they read. It is not stable, and it loses a factor log n against n log n sorts, so on large inputs GPU radix sort and mergesort overtook it. It survives as the sort for small blocks in fast on-chip memory, the base case of faster GPU sorts, and wherever a data-independent schedule is required.
