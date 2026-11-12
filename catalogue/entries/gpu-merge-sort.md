---
id: gpu-merge-sort
title: Mergesort on a GPU
taxonomy: sorting/parallel
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [bitonic-sort, parallel-merge-sort]
  objectives:
  - 'Read the Rounds readout at 512 keys: 5 launches, one sorting every tile of 32 keys and one for each doubling of the runs, 32 to 512.'
  - 'Read the Lanes readout: 32, the threads of the last merge, one per 16 output keys.'
  - 'Read the Array writes: 2,560, every launch writing all 512 keys.'
  misconceptions:
  - 'The tile sort adapts to the input; it is a bitonic network, 240 comparators per tile of 32 keys on every input, and it reorders equal keys.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons (bitonic comparators in the tiles, co-rank searches and merges), array writes and auxiliary writes (each launch writes every key), rounds (kernel launches) and lanes (threads)'
  average: 'on every input of n ≥ 2 keys 1 + ⌈lg ⌈n/32⌉⌉ launches, as many rounds and phases, and that many times n array writes and auxiliary writes; the tile sort makes the same comparisons on every input, 240 per full tile; max(⌊min(n, 32)/2⌋, ⌈n/16⌉ above 32 keys) lanes'
claims:
  - id: five-launches
    statement: >-
      On Random permutation at 512 keys GPU merge sort takes 5 rounds, one launch sorting the 16 tiles of 32 keys and four merge-path launches doubling the runs to 64, 128, 256 and 512 keys.
    readout: Rounds
    expect: { value: 5 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Two phases: every block of threads sorts its tile in fast on-chip memory, then sorted runs are merged in pairs, round after round, with every merge cut into many equal, independent pieces so that thousands of threads stay busy even when only a few long runs remain.

The cut comes from merge path. Merging A and B is a path through an |A| × |B| grid that steps right when it takes from A and down when it takes from B; diagonals across the grid divide the output into equal lengths, and a binary search finds where the path crosses each one. Every thread then merges exactly the same number of elements, whatever the data.

The plate runs the threads' merges one after another and counts total work: order n log n comparisons in every case, plus a binary search of order log n per piece. Start with Random permutation at n = 256 and watch the tiles become sorted first, then the runs double. Extra space is linear, one output buffer per round; the method is stable as a variant, when ties go to the left run and the cuts follow the same rule, but the plate's tile sort is a bitonic network, which reorders equal keys.

At publication the 2009 design was the fastest comparison sort reported, slower than its sibling GPU radix sort but usable for any key with a comparison function. That is when to reach for it: variable-length keys, composite records, custom orders or a stable comparison sort; for fixed-length keys radix sort is usually faster.
