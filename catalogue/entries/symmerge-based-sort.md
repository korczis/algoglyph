---
id: symmerge-based-sort
title: SymMerge sort
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: kim-2004
    ref: the SymMerge algorithm and its bounds
  - id: go-2024
    ref: sort.Stable, a production use
tags:
  - sorting
  - merging
  - stable
  - in-place
  - rotations
complexity: n log n best, n log² n average and worst; extra space log n
related:
  - block-merge-sort
  - in-place-merge-sort
  - insertion-sort
  - mergesort-top-down
motivation: Go's standard library sorts stably with it, in sort.Stable.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [mergesort-bottom-up, insertion-sort]
  objectives:
  - 'Read the Auxiliary writes: none on any input; keys move only by exchanges inside the array.'
  - 'Count Already sorted at 512 keys: 637 comparisons and no write, each merge ending after its binary search.'
  - 'Up to 20 keys count insertion sort alone: the Array writes are twice the inversions.'
  misconceptions:
  - 'An n log² n sort cannot be quick on sorted input; on Already sorted SymMerge makes fewer than 4n/3 comparisons and moves nothing.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes) and auxiliary writes'
  best: 'no writes and fewer than 4n/3 comparisons on Already sorted, for every n up to 1,024'
  average: 'up to 20 keys insertion sort alone, with array writes = 2 × inversions and inversions ≤ comparisons ≤ inversions + n − 1; no auxiliary write on any input, every array write half of an exchange'
  worst: 'O(n log n) comparisons and O(n log² n) exchanges (Kim and Kutzner)'
claims:
  - id: sorted-is-linear
    statement: >-
      On Already sorted at 512 keys SymMerge sort makes 637 comparisons, far below n lg n = 4,608, and moves no key.
    readout: Comparisons
    expect: { value: 637 }
    setup:
      params: { shape: sorted, n: 512, speed: 2000 }
---

Mergesort whose merge works in place by recursion: Kim and Kutzner's SymMerge finds a split point placed symmetrically around the middle of the two runs by binary search, rotates the two middle pieces past each other, and merges the two smaller pairs that result in the same way.

A rotation of neighbouring blocks needs no extra array and keeps the inner order of both pieces, so equal keys never overtake each other and the sort is stable. Go's sort.Stable uses exactly this shape: insertion sort on blocks of 20 keys, then SymMerge on neighbouring blocks of doubling width. Start with Random permutation at n = 256 and watch the writes: the auxiliary strip stays empty, and keys travel in long rotations rather than through a buffer.

Merging runs of lengths M ≤ N costs O(M log(N/M + 1)) comparisons, asymptotically optimal, but O((M + N) log M) assignments in the rotations. Over the whole sort that is O(n log n) comparisons and O(n log n log n) swaps, so the time is n log² n; on Already sorted, though, every merge ends after its binary search and moves nothing, and the comparisons fall to fewer than 4n/3. The only extra memory is a recursion stack about log n deep.

It is the simple route to stable in-place sorting: no buffer of distinct keys and no block bookkeeping, unlike block merge sort, WikiSort or GrailSort, which reach n log n with far more intricate code. It pays off when comparisons are expensive and moves cheap; with cheap comparisons on large arrays a mergesort with an auxiliary array is faster.
