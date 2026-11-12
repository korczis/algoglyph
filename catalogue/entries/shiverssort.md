---
id: shiverssort
title: ShiversSort
taxonomy: sorting/mergesort
status: planned
engine: array
labs:
  - sorting
sources:
  - id: juge-2020
    ref: the merge policy and its bounds
  - id: buss-2019
    ref: merge-cost bounds and the k-aware classification
tags:
  - sorting
  - merging
  - stable
  - adaptive
  - runs
complexity: n best, n log n average and worst; extra space n
related:
  - mergesort-natural
---

A natural mergesort with a stack of runs and a rule on their logarithms: give each run of length r the level ⌊log₂ r⌋, and while the top run's level is at least that of the run below it, merge the two; otherwise push the next run.

The rule looks only at the top two runs, which places it among the strategies Buss and Knop call 2-aware, and it merges only neighbouring runs, so it is stable. The level is a measure of size: two runs are merged once they are roughly comparable. Start with Organ pipe at n = 128, which gives a couple of long runs, then Random permutation, which gives many short ones, and compare how often merges happen.

Its worst-case merge cost is n log₂ n + O(n), optimal up to the linear term when n is the only parameter, with a stack invariant that is the analogue of Timsort's and lowers the hidden constant from 3/2 to 1. Already sorted is a single run and costs only the n − 1 comparisons that find it.

Its weakness is that it does not adapt to the number of runs: a newly pushed run can trigger merges even when it is far longer than those below it, and Jugé gives a lower bound of ω(n log ρ) on inputs with ρ runs. That is what Adaptive ShiversSort fixes; ShiversSort itself is best read as the study case for how a rule on run levels buys a small constant.
