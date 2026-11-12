---
id: block-merge-sort
title: Block merge sort
taxonomy: sorting/mergesort
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [in-place-merge-sort]
  objectives:
  - 'Read the Auxiliary writes: none on any input, the tags and the buffer are keys of the array itself.'
  - 'Count Already sorted: no write, every pair of runs already in order is skipped.'
  - 'On Few distinct keys watch the Phase readout pass through not enough distinct values: rotation merges.'
  misconceptions:
  - 'A stable sort needs an auxiliary array; block merge sort keeps equal keys in order with no auxiliary write at all.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes) and auxiliary writes'
  best: 'no writes on Already sorted'
  average: 'up to 16 keys insertion sort alone, with array writes = 2 × inversions and inversions ≤ comparisons ≤ inversions + n − 1; no auxiliary write on any input, every array write half of an exchange'
  worst: 'O(n log n): Kim and Kutzner''s linear stable merge over the log n bottom-up levels'
claims:
  - id: no-auxiliary-write
    statement: >-
      On Random permutation at 512 keys block merge sort makes no auxiliary write, though it is stable.
    readout: Auxiliary writes
    expect: { value: 0 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

A stable mergesort with constant extra space: merge two neighbouring sorted runs A and B inside the array by cutting A into blocks, threading the blocks through B to roughly where they belong, and merging each block locally with the keys of B that follow it.

The trick that makes it possible without an auxiliary array is a small set of mutually distinct keys pulled out of the input to serve as an internal buffer and as tags that keep blocks with equal keys in order. At the end the buffer is sorted and returned, which preserves stability. Kim and Kutzner's merge of runs of lengths m ≤ n uses O(m log(n/m + 1)) comparisons and a linear number of moves, and log n bottom-up levels give n log n in every case.

Start with Random permutation at n = 256: the auxiliary strip stays empty, and blocks move by rotations and exchanges inside the array. Then try Few distinct keys, where gathering enough distinct keys for the buffer is hardest, which is one of the cases a real implementation must handle along with unequal run lengths and a last partial block.

It is the method of choice when stability, a guaranteed n log n and constant memory are all required at once, a combination ordinary mergesort cannot offer. WikiSort and GrailSort are its best-known implementations.
