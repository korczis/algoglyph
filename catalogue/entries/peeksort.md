---
id: peeksort
title: Peeksort
taxonomy: sorting/mergesort
status: planned
engine: array
labs:
  - sorting
sources:
  - id: munro-wild-2018
    ref: the original description
  - id: juge-2020
    ref: the n(H + 3) merge-cost bound
  - id: peters-2002
    ref: why CPython chose powersort instead
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
  - mergesort-top-down
  - powersort
---

Top-down mergesort that peeks before it splits: instead of cutting the range exactly in half, it cuts at the run boundary nearest the middle, sorts both sides recursively and merges them, so a range that is already a single run is left alone.

The recursion becomes an approximate balanced merge tree over the natural runs: the boundary in the middle is merged last, shorter stretches earlier, and a run that lies inside one side is never split. A blind split in half would cut through runs and add work. Start with Organ pipe at n = 256, which has one boundary near the middle, and compare its merge traffic with mergesort-top-down on the same input.

Merge cost is measured as the total length of everything merged and compared with nH, where H is the entropy of the run lengths; nH is a lower bound for every stable natural mergesort. Peeksort's cost is at most n(H + 3), a slightly weaker guarantee than powersort's n(H + 2). Since H ≤ log₂ n the worst case is n log n, and on Already sorted the whole array is one run, recognised in linear time.

It suits code that already has a recursive mergesort and wants it run-adaptive without a stack of runs and merge rules. Libraries that scan left to right and handle each run as it is found prefer powersort, its bottom-up sibling, which is what CPython adopted.
