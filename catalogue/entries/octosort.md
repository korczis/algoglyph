---
id: octosort
title: Octosort
taxonomy: sorting/hybrid
status: live
engine: array
labs:
  - sorting
sources:
  - id: vandenhoven-2021-octosort
    ref: reference implementation and its README
  - id: vandenhoven-2021-blitsort
    ref: comparison with its successor
tags:
  - sorting
  - hybrid
  - stable
  - in-place
  - adaptive
  - block merge
complexity: n best, n log n average and worst; extra space 1
related:
  - blitsort
  - block-merge-sort
  - grailsort
  - quadsort
  - wikisort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [binary-insertion-sort, mergesort-bottom-up]
  objectives:
  - 'Run Already sorted at 512 keys: no write, and 1,663 comparisons, 103 for the binary insertion of each run of 32 and one for each of the 15 merges, which find their runs already in order.'
  - 'Follow the Phase readout at 512 keys: runs of 32 built by binary insertion, then merges of runs of 32, 64, 128 and 256.'
  - 'Up to 32 keys only the binary insertion runs, counted exactly, with no auxiliary write.'
  misconceptions:
  - 'A merge sort in constant extra memory has to give up adaptivity; on Already sorted octosort writes nothing, and each merge costs one comparison.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons, array writes (copies through the 32-key buffer, exchanges of two writes in the rotations, shifts in the insertion sort) and auxiliary writes (the buffer, each cell that changes)'
  best: 'no write on Already sorted and on keys all equal: the binary insertions of the runs of 32 and one comparison for each of the ⌈n/32⌉ − 1 merges, 1,663 at 512 keys'
  average: 'up to 32 keys a stable binary insertion sort alone, counted exactly, with no auxiliary write'
claims:
  - id: sorted-writes-nothing
    statement: >-
      On Already sorted at 512 keys octosort makes 1,663 comparisons and no write: 103 for each run of 32 built by binary insertion and one for each of the 15 merges, all of which find their two runs already in order.
    readout: Comparisons
    expect: { value: 1663 }
    setup:
      params: { shape: sorted, n: 512 }
---

A stable bottom-up merge sort in constant extra memory: binary insertion sorts runs of 32 keys, then neighbouring runs are merged in pairs through a 32-key buffer when the shorter one fits it, and split by a binary search and a rotation when neither does; two runs already in order cost one comparison.

The author's repository describes it as WikiSort's block merge sort with faster parts and documents the changes rather than the block merge itself: an octo swap that sorts four to eight keys at once and handles reversed runs, a monobound binary search, a rotation by triple reversal, and quadsort's merge routine. The kernel keeps the rotation by triple reversal and the merges through a small buffer, builds its first runs by binary insertion, and splits a merge too large for the buffer at the middle of its longer run, a symmetric rotation merge. Read the block merge sort and WikiSort entries for how blocks are rearranged and merged in the original.

Start with Random permutation at n = 256 and follow the Phase readout: the runs of 32 built by binary insertion, then one round of merges for every doubling of the run length. Already sorted writes nothing at all: 1,663 comparisons at 512 keys, 103 for each run's binary insertion and one for each of the 15 merges. Few distinct keys is a good third input, since stability with constant extra memory is the method's whole point.

Its table claims n comparisons at best, n log n on average and at worst, and constant extra memory; there is no peer-reviewed analysis and the table does not count moves. Its author reports the later Blitsort as faster in the same role.
