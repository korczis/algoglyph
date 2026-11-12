---
id: gpu-radix-sort
title: Radix sort on a GPU
taxonomy: sorting/parallel
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [parallel-radix-sort]
  objectives:
  - 'Read the Rounds readout at 512 keys: 9, one launch for each of the local split sort and histogram, the scan and the scatter, for each of the 3 base-16 digits.'
  - 'Read the Lanes readout: ⌈n/64⌉ thread blocks, 8 at 512 keys.'
  - 'Read the Array writes: 2dn, 3,072 at 512 keys, the local sort and the scatter each writing every key once per pass.'
  misconceptions:
  - 'Sorting each tile locally first is extra work that a GPU could skip; it costs a second write of every key per pass, 3,072 writes against parallel radix sort''s 1,536, to make the global writes contiguous.'
algorithm:
  paradigm: iterative-refinement
  properties:
    stable: true
    in_place: false
    comparison_based: false
bounds:
  model: 'array writes (local sort and scatter), auxiliary writes (the tile in shared memory), rounds (kernel launches) and lanes (thread blocks of 64 keys); no comparison'
  average: 'on every input of n ≥ 2 keys, for the d base-16 digits of max − min: 3d rounds, ⌈n/64⌉ lanes, 2d·n array writes, at most d·n auxiliary writes and no comparison'
claims:
  - id: three-launches-per-digit
    statement: >-
      On Random permutation at 512 keys GPU radix sort takes 9 rounds, a launch of the local split sort, the scan and the scatter for each of the 3 base-16 digits of the key range 511.
    readout: Rounds
    expect: { value: 9 }
    setup:
      params: { shape: random, n: 512 }
---

Parallel LSD radix sort shaped for a graphics processor: the input is cut into tiles, one block of threads per tile; in every digit pass a block sorts its tile by the digit in fast on-chip memory, writes a histogram, a global prefix sum over all histograms (by digit, then by block) gives each block its write positions, and the block scatters its elements there.

The basic operation is the parallel prefix sum, the scan: it computes both the positions inside a tile and the global offsets. Sorting each tile locally first puts the elements with equal digits next to each other, so the writes to global memory are contiguous. The design rests on fine-grained parallelism, independent tasks with little global communication, and on-chip memory.

The plate runs the blocks' steps one after another and counts total work, of order d(n + k) for d digits of k values plus the per-pass histograms and prefix sums; it never compares two keys. Start with Random permutation at n = 256 and follow one digit pass at a time through the auxiliary buffer. Every pass is stable, which LSD radix sort needs to be correct, so the whole sort is stable.

At publication the 2009 design was the fastest GPU sort reported, up to four times faster than the graphics-based GPUSort; fused-kernel variants published in 2011 sped it up further, past a billion 32-bit keys per second on one GPU. It is the choice for large arrays of fixed-length keys; keys of variable length or a custom comparison call for GPU mergesort instead.
