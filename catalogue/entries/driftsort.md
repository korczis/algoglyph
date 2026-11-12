---
id: driftsort
title: Driftsort
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: bergdoll-2024b
    ref: the design write-up
  - id: rust-2024b
    ref: adoption in Rust 1.81.0
  - id: peters-2023
    ref: glidesort, the design it derives from
  - id: munro-wild-2018
    ref: the powersort merge policy
tags:
  - sorting
  - merging
  - stable
  - adaptive
  - duplicate keys
complexity: n best, n log n average and worst; extra space n
related:
  - glidesort
  - ipnsort
  - pdqsort
  - powersort
  - timsort
motivation: Rust's slice::sort has been driftsort since Rust 1.81.0.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [glidesort]
  objectives:
  - 'Count Already sorted from 21 keys on: n − 1 comparisons and no write; Reversed adds 2⌊n/2⌋ writes.'
  - 'Up to 20 keys count insertion sort alone: the Array writes are twice the inversions.'
  - 'Compare Few distinct keys with Random permutation at 512 keys: fewer than half the comparisons, the pivot record at work.'
  misconceptions:
  - 'A stable mergesort cannot profit from repeated keys; on Few distinct keys at 512 keys driftsort makes fewer than ½ n lg n comparisons, fewer than top-down mergesort on any input of that size.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes, a copy one) and auxiliary writes (the shorter run, copied for each merge)'
  best: 'from 21 keys on, n − 1 comparisons and no writes (Already sorted, keys all equal); n − 1 comparisons and 2⌊n/2⌋ array writes on Reversed, no auxiliary write'
  average: 'up to 20 keys insertion sort alone, with array writes = 2 × inversions and inversions ≤ comparisons ≤ inversions + n − 1; an expected N log K for K distinct keys (the authors'' claim)'
  worst: 'N log N comparisons (the authors'' claim)'
claims:
  - id: few-keys-below-mergesort
    statement: >-
      On Few distinct keys at 512 keys driftsort makes fewer than ½ n lg n = 2,304 comparisons, the fewest top-down mergesort makes on any input of 512 keys.
    readout: Comparisons
    expect: { below: 2304 }
    setup:
      params: { shape: few-unique, n: 512 }
---

Rust's stable sort since 1.81.0: a derivative of glidesort that finds sorted runs lazily, sorts the stretches between them with a stable quicksort, and merges the resulting runs in powersort's order.

Its parts, in order: inputs of up to 20 keys go straight to insertion sort without allocating; a linear scan with early exit accepts only runs of at least about √N keys and does not retry a stretch where the first attempt failed; unsorted stretches go to a branchless stable quicksort whose pivot is a recursive median of three approximating a √N sample; a record of earlier pivots catches heavily repeated keys; and past a recursion depth of 2 log₂ N it switches to mergesort for good, the introsort-like guard behind its N log N worst case.

The authors claim at most N log N comparisons, N for fully ascending or descending input and an expected N log K for K distinct keys. Try Nearly sorted at n = 256, which becomes one long run plus a short tail for the quicksort, and Few distinct keys, where the pivot record pays off. It allocates a full N-key buffer only while that stays under 8 MB, and N/2 beyond.

There is no peer-reviewed analysis of driftsort as a whole; the guarantees are the authors' claims, checked by tests and measurements, and only the powersort merge policy has been analysed. The authors themselves recommend the unstable sort, ipnsort, for integers without long sorted stretches, and glidesort remains the more general variant with an arbitrarily small buffer.
