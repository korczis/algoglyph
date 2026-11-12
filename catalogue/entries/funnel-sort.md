---
id: funnel-sort
title: Funnelsort
taxonomy: sorting/external
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [k-way-merge-sort, external-merge-sort]
  objectives:
  - 'Read the Phase readout at 512 keys: 41 funnel merges, one 8-funnel over segments of 64 keys, eight 4-funnels over segments of 16, and 32 3-funnels over segments of 6 or fewer sorted by insertion.'
  - 'Read the Auxiliary writes at 512 keys: 3,392 on every input, every key buffered once by each merger above it.'
  - 'Run Already sorted at 512 keys: 1,536 array writes, n for each of the three levels of funnels.'
  misconceptions:
  - 'The funnel''s buffer traffic depends on the data; at a given n it is the same on every input, 3,392 auxiliary writes at 512 keys, because each merger''s buffer receives every key of its subtree exactly once.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
bounds:
  model: 'comparisons (insertion sorts of segments of at most 8 keys and the mergers), array writes (insertion exchanges, two each, and every funnel''s output) and auxiliary writes (the mergers'' buffers); k = ⌈n^(1/3)⌉ segments, at least 2'
  average: 'on every input of n keys the same auxiliary writes, the keys of each merger''s subtree summed over every funnel (3,392 at 512 keys), and one phase per funnel merge (41 at 512 keys); on Already sorted n array writes per level of funnels, 1,536 at 512 keys; the cache-oblivious O((n/B) log_{M/B}(n/B)) transfers are Frigo et al.''s'
claims:
  - id: buffer-traffic-fixed-by-n
    statement: >-
      On Already sorted at 512 keys funnelsort makes 3,392 auxiliary writes, exactly as many as on Random permutation: every merger's buffer receives each key of its subtree once, whatever the order of the keys.
    readout: Auxiliary writes
    expect: { value: 3392 }
    setup:
      params: { shape: sorted, n: 512 }
---

A mergesort for a memory hierarchy whose sizes it does not know: split the input into n^(1/3) pieces of n^(2/3), sort each recursively, and merge them with a single funnel, a recursively laid out tree of binary mergers with a buffer on every edge.

The buffers are sized so that every sub-funnel fits in cache at some scale, whatever the cache and block sizes are. That is what cache-oblivious means: one program, tuned to no hardware, transfers O((n/B) log_{M/B}(n/B)) blocks at every level of the hierarchy at once, the lower bound for sorting. The proof needs a tall cache, M = Ω(B²).

The plate shows the funnel's buffers in the auxiliary strip and counts element operations; cache misses are the model in these notes. Start with Random permutation at n = 512, the largest size, since the recursive structure only appears on large inputs: 41 funnels on three levels. On small ones there is little to see: up to 8 keys insertion sort does all the work, and up to 24 keys a single 3-funnel merges three segments that insertion sort has sorted.

Frigo, Leiserson, Prokop and Ramachandran introduced it in 1999 with the cache-oblivious model itself; Brodal and Fagerberg simplified it into lazy funnelsort, which fills buffers only on demand. Its constants are higher than those of a plain mergesort or quicksort and it brings nothing on data that fit in cache. The original work does not address stability.
