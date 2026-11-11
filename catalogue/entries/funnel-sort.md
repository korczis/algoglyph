---
id: funnel-sort
title: Funnelsort
taxonomy: sorting/external
status: planned
engine: array
labs:
  - sorting
sources:
  - id: frigo-1999
    ref: the original description and the cache-oblivious model
  - id: frigo-2012
    ref: the journal version and the tall-cache proof
  - id: brodal-2002
    ref: lazy funnelsort
  - id: aggarwal-1988
    ref: the I/O lower bound it meets
tags:
  - sorting
  - external sorting
  - merging
  - cache-oblivious
complexity: n log n comparisons in every case; O((n/B) log_{M/B}(n/B)) block transfers under a tall cache; extra space n
related:
  - external-merge-sort
  - k-way-merge-sort
  - mergesort-top-down
---

A mergesort for a memory hierarchy whose sizes it does not know: split the input into n^(1/3) pieces of n^(2/3), sort each recursively, and merge them with a single funnel, a recursively laid out tree of binary mergers with a buffer on every edge.

The buffers are sized so that every sub-funnel fits in cache at some scale, whatever the cache and block sizes are. That is what cache-oblivious means: one program, tuned to no hardware, transfers O((n/B) log_{M/B}(n/B)) blocks at every level of the hierarchy at once, the lower bound for sorting. The proof needs a tall cache, M = Ω(B²).

The plate shows the funnel's buffers in the auxiliary strip and counts element operations; cache misses are the model in these notes. Start with Random permutation at n = 512, the largest size, since the recursive structure only appears on large inputs; on small ones the funnel is an ordinary two-way merge.

Frigo, Leiserson, Prokop and Ramachandran introduced it in 1999 with the cache-oblivious model itself; Brodal and Fagerberg simplified it into lazy funnelsort, which fills buffers only on demand. Its constants are higher than those of a plain mergesort or quicksort and it brings nothing on data that fit in cache. The original work does not address stability.
