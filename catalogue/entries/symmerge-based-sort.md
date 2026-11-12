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
---

Mergesort whose merge works in place by recursion: Kim and Kutzner's SymMerge finds a split point placed symmetrically around the middle of the two runs by binary search, rotates the two middle pieces past each other, and merges the two smaller pairs that result in the same way.

A rotation of neighbouring blocks needs no extra array and keeps the inner order of both pieces, so equal keys never overtake each other and the sort is stable. Go's sort.Stable uses exactly this shape: insertion sort on blocks of 20 keys, then SymMerge on neighbouring blocks of doubling width. Start with Random permutation at n = 256 and watch the writes: the auxiliary strip stays empty, and keys travel in long rotations rather than through a buffer.

Merging runs of lengths M ≤ N costs O(M log(N/M + 1)) comparisons, asymptotically optimal, but O((M + N) log M) assignments in the rotations. Over the whole sort that is O(n log n) comparisons and O(n log n log n) swaps, which is why the comparison count stays n log n even on Already sorted while the time is n log² n; the only extra memory is a recursion stack about log n deep.

It is the simple route to stable in-place sorting: no buffer of distinct keys and no block bookkeeping, unlike block merge sort, WikiSort or GrailSort, which reach n log n with far more intricate code. It pays off when comparisons are expensive and moves cheap; with cheap comparisons on large arrays a mergesort with an auxiliary array is faster.
