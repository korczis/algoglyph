---
id: grailsort
title: GrailSort
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: astrelin-2013
    ref: reference implementation and benchmarks
  - id: huang-1992
    ref: the stable constant-space merge it builds on
tags:
  - sorting
  - merging
  - stable
  - in-place
  - blocks
complexity: n log n in every case; extra space 1
related:
  - block-merge-sort
  - in-place-merge-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [block-merge-sort]
  objectives:
  - 'Read the Auxiliary writes: none on any input.'
  - 'On Few distinct keys from 17 keys on read the Phase readout: two phases, the key search and the lazy stable sort that replaces the buffer.'
  - 'Count Already sorted at 512 keys: no shortcut through the buffer, 1,669 comparisons and 5,504 array writes.'
  misconceptions:
  - 'GrailSort always merges through its buffer; with fewer distinct keys than the buffer needs it falls back to rotation merges, as the Phase readout shows on Few distinct keys.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes) and auxiliary writes'
  average: 'up to 16 keys insertion sort alone, with array writes = 2 × inversions and inversions ≤ comparisons ≤ inversions + n − 1; no auxiliary write on any input, every array write half of an exchange; no writes when all keys are equal'
  worst: 'O(n log n): Huang and Langston''s stable merging in constant extra space'
claims:
  - id: few-keys-lazy-sort
    statement: >-
      On Few distinct keys at 512 keys GrailSort ends after two phases: it finds too few distinct keys for its buffer and sorts by the lazy stable sort instead.
    readout: Phase
    expect: { value: 2 }
    setup:
      params: { shape: few-unique, n: 512, speed: 2000 }
---

A stable in-place block mergesort with an O(n log n) worst case, built on Huang and Langston's stable merging in constant extra space: it collects distinct keys from the input to act as an internal buffer and sorts the rest by block merges.

The buffer must consist of mutually distinct keys; then exchanges with it cannot shuffle equal keys of the data being merged, and at the end it can be sorted and merged back without breaking stability. In outline: gather about 2√n distinct keys at the front, sort the remainder bottom-up with block merges that use the buffer, then sort the buffer and merge it with the rest.

Nothing in it shortcuts sorted input, so best, average and worst cases are all n log n. The repository also offers variants with a fixed external buffer of 512 elements and with a dynamically allocated buffer of fewer than 2√n elements, which speed the merges up. Start with Random permutation at n = 256, then switch to Few distinct keys: with so few distinct values a buffer of the full size cannot be assembled, and the implementation has to fall back on a slower path.

There is no peer-reviewed analysis of this implementation; the cited paper analyses the merging technique, not the code. The author's benchmarks against std::stable_sort show it faster on some kinds of input and slower on others, so it is worth testing on one's own data, especially data with few distinct keys.
