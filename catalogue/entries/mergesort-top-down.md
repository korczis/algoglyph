---
id: mergesort-top-down
title: Mergesort, top-down
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
  - divide and conquer
  - auxiliary memory
complexity: at most n lg n compares, n extra space
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - 'Read the Array writes and the Auxiliary writes: equal, and the same on every input of n keys, 4,608 = n lg n at 512.'
  - 'Count Already sorted and Reversed at 512 keys: 2,304 comparisons each, ½ n lg n, where Random permutation needs more but never more than n lg n − n + 1 = 4,097.'
  - 'Explain why a merge costs at least the length of its shorter half in comparisons, and at most one fewer than its keys.'
  misconceptions:
  - 'Mergesort is cheapest on sorted input; at a power of two Already sorted and Reversed cost the same ½ n lg n comparisons, and the writes do not change with the input at all.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: false
bounds:
  model: 'comparisons, array writes and auxiliary writes (each merge copies its range to the auxiliary array and writes it back, one write per key each way)'
  best: 'Σ_{k<n} ν(k) comparisons, the 1-bits in the binary forms of 0, …, n − 1 (Reversed, the fewest of any input); ½ n lg n when n is a power of two, as on Already sorted'
  average: 'on every input array writes = auxiliary writes = n⌈lg n⌉ − 2^⌈lg n⌉ + n, n lg n when n is a power of two, and comparisons ≤ array writes − (n − 1)'
  worst: 'n⌈lg n⌉ − 2^⌈lg n⌉ + 1 comparisons, reached by some permutation of every size up to 8 keys'
claims:
  - id: writes-ignore-the-input
    statement: >-
      On Random permutation at 512 keys the Array writes are n lg n = 4,608, as on every other input of 512 keys.
    readout: Array writes
    expect: { value: 4608 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Sort each half recursively, then merge the two sorted halves.

The lower strip is the auxiliary array: each merge copies its range there and writes the merged keys back.

Comparisons barely depend on the input, writes not at all: mergesort is the predictable one.
