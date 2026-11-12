---
id: buffer-tree-sort
title: Buffer tree sort
taxonomy: sorting/external
status: live
engine: array
labs:
  - sorting
sources:
  - id: arge-1995
    ref: the original description
  - id: arge-2003
    ref: the journal version and its analysis
  - id: aggarwal-1988
    ref: the I/O lower bound it meets
  - id: vitter-2008
    ref: comparison with B-tree insertion
tags:
  - sorting
  - external sorting
  - search tree
  - batching
complexity: n log n comparisons in every case; O((N/B) log_{M/B}(N/B)) block transfers; extra space n
related:
  - b-tree
  - external-merge-sort
  - funnel-sort
  - heapsort
  - tree-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [b-tree, external-merge-sort]
  objectives:
  - 'Count the root buffer''s emptyings in the Phase readout at 512 keys: ⌊512/23⌋ = 22, one burst of work per full buffer.'
  - 'Read the Auxiliary writes: n on every input, each key appended to the root buffer once.'
  - 'Read the Array writes: n, the leaves written out in order once at the end.'
  misconceptions:
  - 'A buffer tree inserts each key down the tree as it arrives; insertions only append to the root buffer, which is emptied down the tree ⌊n/M⌋ times, 22 at 512 keys.'
algorithm:
  paradigm: incremental
  properties:
    in_place: false
bounds:
  model: 'comparisons (buffer sorts, routing among splitters and leaf merges), array writes (the leaves written out once), auxiliary writes (the root buffer) and phases; leaves of at most 8 keys, fan-out 4, M = max(4, ⌈√n⌉)'
  average: 'on every input of n ≥ 2 keys exactly n array writes, n auxiliary writes and ⌊n/M⌋ emptyings of the root buffer; the O((N/B) log_{M/B}(N/B)) transfers are Arge''s bound in the I/O model'
claims:
  - id: root-buffer-only
    statement: >-
      On Random permutation at 512 keys buffer tree sort makes 512 auxiliary writes, one per key: an insertion only appends to the root buffer, and the work below it happens when the buffer is emptied.
    readout: Auxiliary writes
    expect: { value: 512 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Tree sort made I/O-optimal by laziness: insert every key into a buffer tree, whose internal nodes each carry a buffer of about M keys, then empty all buffers and read the leaves from left to right.

An insertion only appends to the root's buffer. When a buffer fills, it is loaded, sorted and passed down to the children in one go, which may overflow them in turn; leaves split as in an (a, b)-tree. With fan-out Θ(M/B) the tree has height log_{M/B}(N/B), and emptying a buffer costs O(1/B) transfers per key and level, so N insertions cost O((N/B) log_{M/B}(N/B)) transfers: the sorting bound. Inserting the keys one by one into a B-tree costs O(N log_B N), asymptotically far more.

The plate shows the root buffer in the auxiliary strip and counts element operations; block transfers are the model in these notes. Start with Random permutation at n = 256 and watch the work arrive in bursts, one per full buffer, rather than one key at a time.

Arge introduced the structure in 1995 as a general technique; sorting was its first and simplest application. For sorting alone it is more complex than external mergesort with the same bound; it earns its keep when sorting is part of batched processing, as an external priority queue or for sweeps in geometry. Its sources do not treat stability.
