---
id: powersort
title: Powersort
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: munro-wild-2018
    ref: the original description
  - id: juge-2020
    ref: the nH to n(H + 2) merge-cost bounds
  - id: peters-2002
    ref: the power computation as CPython implements it
  - id: bergdoll-2024b
    ref: its merge policy inside driftsort
tags:
  - sorting
  - merging
  - stable
  - adaptive
  - runs
complexity: n best, n log n average and worst; extra space n
related:
  - adaptiveshiverssort
  - mergesort-natural
  - shiverssort
motivation: CPython's list.sort uses its merge policy, and so does the merge phase of Rust's stable sort.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [timsort]
  objectives:
  - 'Count Organ pipe at 512 keys: two runs and one merge, 2(n − 1) = 1,022 comparisons and 255 auxiliary writes.'
  - 'Count Already sorted and Reversed: n − 1 comparisons and no auxiliary write; Reversed adds 2⌊n/2⌋ writes.'
  - 'Compute H for an input of long runs and check the comparisons against n − 1 + n(H + 2).'
  misconceptions:
  - 'A nearly optimal merge order needs every run in advance; powersort decides each merge as the runs arrive, from the power of one boundary, and stays within n(H + 2) of merge cost.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes, a copy one) and auxiliary writes (the shorter run, copied for each merge)'
  best: 'n − 1 comparisons and no writes (Already sorted, keys all equal); n − 1 comparisons and 2⌊n/2⌋ array writes on Reversed, one strictly descending run reversed in place; no auxiliary write on either'
  average: 'with every run at least minrun long, comparisons ≤ n − 1 + n(H + 2), H the entropy of the run lengths (merge cost between nH and n(H + 2), Munro and Wild); Organ pipe from 64 keys on 2(n − 1) comparisons and ⌊(n − 1)/2⌋ auxiliary writes'
  worst: 'O(n log n) comparisons, since H ≤ lg n'
claims:
  - id: organ-pipe-is-one-merge
    statement: >-
      On Organ pipe at 512 keys powersort finds two runs and merges them once: 2(n − 1) = 1,022 comparisons.
    readout: Comparisons
    expect: { value: 1022 }
    setup:
      params: { shape: organ-pipe, n: 512, speed: 2000 }
---

A natural mergesort that finds a nearly optimal merge order almost for free: every boundary between neighbouring runs gets an integer power, the depth at which a perfectly balanced merge tree would join those two runs, and runs are merged so that powers on the stack decrease strictly from the top down.

The power comes from the midpoints of the two runs as fractions of n: it is the first binary digit at which the two fractions differ. Boundaries near the middle of the array get small powers and are merged last; boundaries inside small regions get large powers and are merged early. It is computed once per run, so the overhead disappears in the noise.

Its merge cost always lies between nH and n(H + 2), where H is the entropy of the run lengths; the lower bound is optimal for every stable merging method. Since H ≤ log₂ n the worst case is n log n, and Already sorted, a single run, costs n − 1 comparisons. Start with Organ pipe at n = 256, then Nearly sorted: the readouts track how few and how uneven the runs are, not n alone.

CPython's list sort, originally Timsort, now merges by the powersort policy, after first extending short natural runs to a minimum length with binary insertion; its notes add that of the published strategies, powersort's is the only one always optimal for three runs. Peeksort is its top-down sibling; both merge only neighbouring runs and are stable.
