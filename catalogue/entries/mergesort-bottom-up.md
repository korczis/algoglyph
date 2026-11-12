---
id: mergesort-bottom-up
title: Mergesort, bottom-up
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - mergesort
  - stable
  - iterative
  - auxiliary memory
complexity: at most n lg n compares, n extra space
related:
  - mergesort-top-down
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites: [mergesort-top-down]
  objectives:
  - 'Compare the Array writes with mergesort-top-down: equal at 256 or 512 keys, more at 264 keys (2,336 against 2,128), where a pass merges a long run with a short tail.'
  - 'Count Reversed: every merge stops after its shorter run, so at a power of two ½ n lg n comparisons.'
  - 'Watch each pass sweep the whole array and double the run length.'
  misconceptions:
  - 'Bottom-up and top-down mergesort do the same work; off the powers of two bottom-up writes more, never less (2,336 against 2,128 at 264 keys).'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: false
bounds:
  model: 'comparisons, array writes and auxiliary writes (each merge copies its range to the auxiliary array and writes it back, one write per key each way)'
  best: 'the shorter run of every merge in comparisons (Reversed, the fewest of any input); ½ n lg n when n is a power of two, as on Already sorted'
  average: 'on every input array writes = auxiliary writes = the keys of every merge of every pass: n lg n when n is a power of two, at most n⌈lg n⌉, and never fewer than top-down mergesort''s'
  worst: 'array writes − (n − 1) comparisons, one fewer than the keys of each of its n − 1 merges, reached by some permutation of every size up to 8 keys'
claims:
  - id: tail-merge-writes-more
    statement: >-
      On Random permutation at 264 keys the Array writes are 2,336, where top-down mergesort writes 2,128 on any input of that size: the last pass merges 256 keys with a tail of 8.
    readout: Array writes
    expect: { value: 2336 }
    setup:
      params: { shape: random, n: 264, speed: 2000 }
---

Merge runs of 1, then 2, 4, 8 and so on across the whole array, without recursion.

Each pass sweeps the whole array once, doubling the run length, so the passes are visible as waves of merges of growing width.
