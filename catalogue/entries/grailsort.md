---
id: grailsort
title: GrailSort
taxonomy: sorting/mergesort
status: planned
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
---

A stable in-place block mergesort with an O(n log n) worst case, built on Huang and Langston's stable merging in constant extra space: it collects distinct keys from the input to act as an internal buffer and sorts the rest by block merges.

The buffer must consist of mutually distinct keys; then exchanges with it cannot shuffle equal keys of the data being merged, and at the end it can be sorted and merged back without breaking stability. In outline: gather about 2√n distinct keys at the front, sort the remainder bottom-up with block merges that use the buffer, then sort the buffer and merge it with the rest.

Nothing in it shortcuts sorted input, so best, average and worst cases are all n log n. The repository also offers variants with a fixed external buffer of 512 elements and with a dynamically allocated buffer of fewer than 2√n elements, which speed the merges up. Start with Random permutation at n = 256, then switch to Few distinct keys: with so few distinct values a buffer of the full size cannot be assembled, and the implementation has to fall back on a slower path.

There is no peer-reviewed analysis of this implementation; the cited paper analyses the merging technique, not the code. The author's benchmarks against std::stable_sort show it faster on some kinds of input and slower on others, so it is worth testing on one's own data, especially data with few distinct keys.
