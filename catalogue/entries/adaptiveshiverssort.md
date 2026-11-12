---
id: adaptiveshiverssort
title: Adaptive ShiversSort
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: juge-2020
    ref: the algorithm and its nH + O(n) bound
  - id: buss-2019
    ref: k-aware merge strategies, the open question it answers
  - id: munro-wild-2018
    ref: powersort and peeksort, the contemporary alternative
tags:
  - sorting
  - merging
  - stable
  - adaptive
  - runs
complexity: n best, n log n average and worst; extra space n
related:
  - mergesort-natural
  - shiverssort
---

A cross of Timsort and ShiversSort: keep Timsort's loop over a stack of runs and its habit of merging the second and third runs from the top, but compare run levels ⌊log₂ r⌋ instead of lengths. While three runs are stacked and the third from the top has a level no larger than the bigger of the two above it, merge the third and second; otherwise push the next run.

Deciding from the top three runs makes it 3-aware in Buss and Knop's terms, and Jugé proved it is the first such strategy whose merge cost is nH + O(n), where H is the entropy of the run lengths, the sum of (rᵢ/n) log₂(n/rᵢ); more precisely at most n(H + Δ) with Δ ≈ 2.478, slightly above powersort's n(H + 2). Since H ≤ log₂ n the worst case is n log n, and a single run, Already sorted, costs linear time.

Unlike ShiversSort, a newly pushed run is not merged at once unless its size allows a sensible merge. Start with Organ pipe at n = 256 and then Random permutation: the fewer and more uneven the runs, the lower H and the cheaper the sort.

Jugé stresses how little it differs from Timsort, about a dozen lines of Java, so a library with Timsort can gain a better worst-case guarantee by swapping the merge rule. It merges only neighbouring runs, so it is stable, and like other mergesorts it needs extra space proportional to the runs being merged.
