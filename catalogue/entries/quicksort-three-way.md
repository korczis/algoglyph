---
id: quicksort-three-way
title: Quicksort, three-way partitioning
taxonomy: sorting/quicksort
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - quicksort
  - duplicate keys
  - dutch national flag
  - in-place
complexity: linear when the number of distinct keys is constant
related:
  - quicksort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [quicksort]
  objectives:
  - 'Count Few distinct keys at 512 keys: fewer than 2d(n − 1) = 4,088 comparisons for its d = 4 distinct keys, a bound two-way quicksort exceeds on the same input.'
  - 'Count Reversed: n(n − 1)/2 comparisons and n(n − 1) array writes, since the first key of every subfile, the pivot, is its largest.'
  - 'Explain why keys equal to the pivot cost nothing after their partition, so that keys all equal are sorted by one partition of 2(n − 1) comparisons and no writes.'
  misconceptions:
  - 'Three-way partitioning protects against the quadratic case; with distinct keys and the first key as pivot it costs up to n(n − 1) comparisons.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
bounds:
  model: 'comparisons and array writes (an exchange is two writes)'
  best: 'linear: 2(n − 1) comparisons and no writes when all keys are equal'
  average: 'on every input with d distinct keys, at most 2d(n − 1) comparisons and 2d(n − 1) array writes: linear when d is fixed'
  worst: 'n(n − 1) comparisons and n(n − 1) array writes, at most on every input and reached on the input an adversary builds against the first-key pivot; n(n − 1)/2 comparisons and n(n − 1) array writes on Reversed'
claims:
  - id: few-distinct-keys-stay-linear
    statement: >-
      On Few distinct keys at 512 keys (d = 4) three-way partitioning stays under the linear
      bound 2d(n − 1) = 4,088 comparisons, which two-way quicksort exceeds on the same input.
    readout: Comparisons
    expect: { below: 4088 }
    setup:
      params: { shape: few-unique, n: 512, speed: 2000 }
---

Dijkstra's three-way partition into keys less than, equal to and greater than the pivot.

Keys equal to the pivot end up in the middle and are never touched again. Choose Few distinct keys: two-way quicksort keeps partitioning runs of equal keys, three-way finishes in a handful of passes.
