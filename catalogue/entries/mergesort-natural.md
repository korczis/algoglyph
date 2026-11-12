---
id: mergesort-natural
title: Natural mergesort
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - mergesort
  - stable
  - adaptive
  - runs
complexity: linear on sorted input, n lg n at worst
related:
  - mergesort-bottom-up
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [mergesort-bottom-up]
  objectives:
  - 'Count Already sorted: one run, n − 1 comparisons and no write at all.'
  - 'Compare Random permutation at 512 keys with mergesort-top-down: about twice the comparisons, because every pass scans the runs again before it merges them.'
  - 'Bound the Array writes by n⌈lg r⌉ for an input of r ascending runs, and check it on Nearly sorted.'
  misconceptions:
  - 'A natural mergesort never costs more than a plain one; on Random permutation at 512 keys its rescans make 1.8 to 2.4 times the comparisons of top-down mergesort.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: false
bounds:
  model: 'comparisons, array writes and auxiliary writes (each merge copies its range to the auxiliary array and writes it back, one write per key each way)'
  best: 'n − 1 comparisons and no writes (Already sorted, keys all equal: one run)'
  average: 'on every input array writes = auxiliary writes ≤ n⌈lg r⌉ for r ascending runs; each pass also scans the runs: Reversed has the merges and writes of bottom-up mergesort and n − 1 comparisons more per scan, (n − 1)(lg n + 1) + ½ n lg n when n is a power of two'
claims:
  - id: sorted-is-one-run
    statement: >-
      On Already sorted at 512 keys natural mergesort finds one run and merges nothing: n − 1 = 511 comparisons.
    readout: Comparisons
    expect: { value: 511 }
    setup:
      params: { shape: sorted, n: 512 }
---

Find the ascending runs the input already has, and merge neighbouring runs until one is left.

On Nearly sorted input there are few runs and a few merges finish the job; on Reversed input every run has length one and it behaves like bottom-up mergesort.
