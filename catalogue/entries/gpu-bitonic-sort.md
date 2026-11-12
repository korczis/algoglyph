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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [bitonic-sort]
  objectives:
  - 'Read the Rounds readout at 512 keys: 15, one round per launch, for the 45 layers of the network: one launch sorting every 32-key tile in shared memory, then for every larger block size a flip, its half-cleaners across tiles and one shared-memory merge.'
  - 'Compare the Comparisons with bitonic sort''s on the same input: 11,520 at 512 keys, the same network.'
  - 'Read the Auxiliary writes: every launch that works in shared memory loads all n keys into its tiles, 2,560 at 512 keys from five such launches.'
  misconceptions:
  - 'A GPU needs one kernel launch per layer of the network; at 512 keys the plate needs 15 launches for the 45 layers, because every layer whose partners lie inside one 32-key tile runs in a single shared-memory kernel.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
bounds:
  model: 'comparisons (one per comparator), array writes (keys stored back from shared memory, and two per global exchange), auxiliary writes (tiles loaded into shared memory) and rounds (kernel launches)'
  average: 'on every input bitonic sort''s comparator count; for K = ⌈lg n⌉, one launch up to 32 keys and (K − 4)(K − 3)/2 above, 15 at 512 keys, and n·max(1, K − 4) auxiliary writes'
claims:
  - id: fewer-launches-than-layers
    statement: >-
      On Random permutation at 512 keys GPU bitonic sort takes 15 launches, a third of the 45 layers of the bitonic network it runs: the layers inside a 32-key tile run in one shared-memory kernel.
    readout: Rounds
    expect: { value: 15 }
    setup:
      params: { shape: random, n: 512 }
---

Batcher's bitonic network run one layer at a time as a pass over the whole array: in every pass each thread takes one position, computes its partner from the position and the layer, compares the two keys and keeps the smaller or the larger according to the direction of its block.

Networks suit a GPU for two reasons. Their schedule does not depend on the data, so every thread does the same thing and the access pattern is known in advance. And early graphics processors could not choose where to write from the input values, which ruled out data-driven sorts such as quicksort, whereas a network always writes to a fixed position.

The plate runs the threads' compare-exchanges one after another and counts the total work: order n log² n comparisons on every input, exactly as the sequential bitonic network. For n = 2^k there are k(k + 1)/2 passes, the partner distance halving within each phase. The rounds in the readouts are the kernel launches, which are fewer: one sort of every tile of 32 keys in shared memory, then for every larger block size a global kernel for each layer whose partners lie in different tiles and one shared-memory kernel for the layers inside a tile. Start with Random permutation at n = 256, then run Already sorted and see the same number of comparisons.

The network itself works in place; early GPU implementations needed a second buffer only because they could not write into the texture they read. It is not stable, and it loses a factor log n against n log n sorts, so on large inputs GPU radix sort and mergesort overtook it. It survives as the sort for small blocks in fast on-chip memory, the base case of faster GPU sorts, and wherever a data-independent schedule is required.
