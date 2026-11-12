---
id: blitsort
title: Blitsort
taxonomy: sorting/hybrid
status: live
engine: array
labs:
  - sorting
sources:
  - id: vandenhoven-2021-blitsort
    ref: reference implementation and its README
  - id: vandenhoven-2021-fluxsort
    ref: the method it adapts
tags:
  - sorting
  - hybrid
  - stable
  - in-place
  - adaptive
  - rotations
complexity: n best, n log n average and worst; extra space log n
related:
  - crumsort
  - fluxsort
  - in-place-merge-sort
  - quadsort
  - symmerge-based-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [fluxsort]
  objectives:
  - 'Compare Random permutation at 512 keys with fluxsort: 12,361 array writes against 5,435, the price of rotating instead of copying through a buffer of n keys.'
  - 'Up to 32 keys only the stable binary insertion runs, counted exactly, with no auxiliary write.'
  - 'Run Already sorted at 512 keys: the kernel has no analyser, so 3,939 comparisons and 2,260 array writes.'
  misconceptions:
  - 'A stable partition in place costs no more moves than one through a buffer; on Random permutation at 512 keys blitsort writes the array more than twice as often as fluxsort.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons, array writes (copies through the 32-key buffer, exchanges of two writes in the rotations, shifts in the insertion sort) and auxiliary writes (the buffer, each cell that changes)'
  average: 'up to 32 keys a stable binary insertion sort alone, counted exactly, with no auxiliary write'
claims:
  - id: rotations-double-the-writes
    statement: >-
      On Random permutation at 512 keys blitsort makes more than twice the 5,435 array writes fluxsort makes on the same input: every range larger than its 32-key buffer is partitioned in pieces, which rotations put together.
    readout: Array writes
    expect: { above: 10870 }
    setup:
      params: { shape: random, n: 512 }
---

Fluxsort without the big buffer: a stable quicksort that makes do with a small fixed buffer and solves everything that does not fit with rotations of adjacent blocks.

A rotation exchanges two neighbouring blocks while keeping the order inside each, so it preserves stability where an exchange of single keys would not. The kernel's stable partition halves a range until a piece fits the 32-key buffer, partitions each piece through the buffer as Fluxsort does, and rotates the larger keys of the left half past the smaller keys of the right half, which keeps both sides in their original order. The author's repository also merges with rotations (take the middle key of the first run, binary-search the second run for the keys below it, rotate, recurse), which the kernel does not, and its buffer holds 512 keys where the kernel's holds 32, so the rotations show on small inputs.

In the repository an analyser like Fluxsort's finishes sorted and reversed input at once and sends mostly sorted stretches to a rotating quadsort. The kernel has none: Already sorted at 512 keys is partitioned like any other input, 3,939 comparisons and 2,260 array writes, and ranges of at most 32 keys are finished by binary insertion. Start with Random permutation at n = 256 and compare its counters with Fluxsort's on the same input: the difference in the write counter is what giving up the large buffer costs in moves, more than twice Fluxsort's writes at 512 keys.

The bounds in the author's table count comparisons only; the cost of the moves made by rotations is not analysed, and there is no peer-reviewed analysis. Recursion needs log n stack, which an explicit stack could reduce further.
