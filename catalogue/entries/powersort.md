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
---

A natural mergesort that finds a nearly optimal merge order almost for free: every boundary between neighbouring runs gets an integer power, the depth at which a perfectly balanced merge tree would join those two runs, and runs are merged so that powers on the stack decrease strictly from the top down.

The power comes from the midpoints of the two runs as fractions of n: it is the first binary digit at which the two fractions differ. Boundaries near the middle of the array get small powers and are merged last; boundaries inside small regions get large powers and are merged early. It is computed once per run, so the overhead disappears in the noise.

Its merge cost always lies between nH and n(H + 2), where H is the entropy of the run lengths; the lower bound is optimal for every stable merging method. Since H ≤ log₂ n the worst case is n log n, and Already sorted, a single run, costs n − 1 comparisons. Start with Organ pipe at n = 256, then Nearly sorted: the readouts track how few and how uneven the runs are, not n alone.

CPython's list sort, originally Timsort, now merges by the powersort policy, after first extending short natural runs to a minimum length with binary insertion; its notes add that of the published strategies, powersort's is the only one always optimal for three runs. Peeksort is its top-down sibling; both merge only neighbouring runs and are stable.
