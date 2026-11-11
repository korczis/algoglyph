---
id: driftsort
title: Driftsort
taxonomy: sorting/mergesort
status: planned
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
---

Rust's stable sort since 1.81.0: a derivative of glidesort that finds sorted runs lazily, sorts the stretches between them with a stable quicksort, and merges the resulting runs in powersort's order.

Its parts, in order: inputs of up to 20 keys go straight to insertion sort without allocating; a linear scan with early exit accepts only runs of at least about √N keys and does not retry a stretch where the first attempt failed; unsorted stretches go to a branchless stable quicksort whose pivot is a recursive median of three approximating a √N sample; a record of earlier pivots catches heavily repeated keys; and past a recursion depth of 2 log₂ N it switches to mergesort for good, the introsort-like guard behind its N log N worst case.

The authors claim at most N log N comparisons, N for fully ascending or descending input and an expected N log K for K distinct keys. Try Nearly sorted at n = 256, which becomes one long run plus a short tail for the quicksort, and Few distinct keys, where the pivot record pays off. It allocates a full N-key buffer only while that stays under 8 MB, and N/2 beyond.

There is no peer-reviewed analysis of driftsort as a whole; the guarantees are the authors' claims, checked by tests and measurements, and only the powersort merge policy has been analysed. The authors themselves recommend the unstable sort, ipnsort, for integers without long sorted stretches, and glidesort remains the more general variant with an arbitrarily small buffer.
