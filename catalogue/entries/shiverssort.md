---
id: shiverssort
title: ShiversSort
taxonomy: sorting/mergesort
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [mergesort-natural]
  objectives:
  - 'Count Organ pipe at 128 keys: two runs and one merge, 2(n − 1) = 254 comparisons.'
  - 'Read the Auxiliary writes as the shorter run of every merge: the comparisons are at least n − 1 for the run search plus that count.'
  - 'Count Already sorted and Reversed: n − 1 comparisons each, no auxiliary write.'
  misconceptions:
  - 'ShiversSort adapts to the number of runs as well as to n; its rule merges by run size alone, and Jugé gives inputs with ρ runs on which it costs ω(n log ρ).'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes, a copy one) and auxiliary writes (the shorter run, copied for each merge)'
  best: 'n − 1 comparisons and no writes (Already sorted, keys all equal); n − 1 comparisons and 2⌊n/2⌋ array writes on Reversed, one strictly descending run reversed in place; no auxiliary write on either'
  average: 'on every input comparisons ≥ n − 1 + auxiliary writes: n − 1 for the run search and at least the shorter run of every merge, which the auxiliary writes count; Organ pipe from 3 keys on 2(n − 1) comparisons and ⌊(n − 1)/2⌋ auxiliary writes'
  worst: 'merge cost n log₂ n + O(n) (Jugé), so O(n log n)'
claims:
  - id: organ-pipe-is-one-merge
    statement: >-
      On Organ pipe at 128 keys ShiversSort finds two runs and merges them once: 2(n − 1) = 254 comparisons.
    readout: Comparisons
    expect: { value: 254 }
    setup:
      params: { shape: organ-pipe, n: 128, speed: 2000 }
---

A natural mergesort with a stack of runs and a rule on their logarithms: give each run of length r the level ⌊log₂ r⌋, and while the top run's level is at least that of the run below it, merge the two; otherwise push the next run.

The rule looks only at the top two runs, which places it among the strategies Buss and Knop call 2-aware, and it merges only neighbouring runs, so it is stable. The level is a measure of size: two runs are merged once they are roughly comparable. Start with Organ pipe at n = 128, which gives a couple of long runs, then Random permutation, which gives many short ones, and compare how often merges happen.

Its worst-case merge cost is n log₂ n + O(n), optimal up to the linear term when n is the only parameter, with a stack invariant that is the analogue of Timsort's and lowers the hidden constant from 3/2 to 1. Already sorted is a single run and costs only the n − 1 comparisons that find it.

Its weakness is that it does not adapt to the number of runs: a newly pushed run can trigger merges even when it is far longer than those below it, and Jugé gives a lower bound of ω(n log ρ) on inputs with ρ runs. That is what Adaptive ShiversSort fixes; ShiversSort itself is best read as the study case for how a rule on run levels buys a small constant.
