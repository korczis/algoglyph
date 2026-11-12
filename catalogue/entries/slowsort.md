---
id: slowsort
title: Slowsort
taxonomy: sorting/esoteric
status: live
engine: custom
sources:
  - id: broder-1984
    ref: the original description and its bounds
  - id: gruber-2007
    ref: slowsort as the starting point of pessimal analysis
  - id: lerma-2014
    ref: sorts slower than any chosen function
tags:
  - sorting
  - esoteric
  - in-place
  - recursion
  - deterministic
complexity: n^(log n / (2+ε)) in every case; extra space n
related:
  - mergesort-top-down
  - stooge-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [mergesort-top-down]
  objectives:
  - 'Read comparisons, counted live at the end of a run at 16 keys: 406 of 406, C(n) = C(⌈n/2⌉) + C(⌊n/2⌋) + 1 + C(n − 1), whatever the input shape.'
  - 'Choose Already sorted: every comparison is still made, and no swap.'
  - 'Read swaps, counted live on Random permutation: never more than the inversions of the input, since every swap removes at least one.'
  misconceptions:
  - 'A recurrence shaped like mergesort''s grows polynomially; the local exponent of slowsort''s exact count keeps rising as n doubles, so no fixed power of n bounds it.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
  invariants:
    - The number of inversions never increases.
bounds:
  model: 'comparisons (one per compare-and-swap of two halves'' maxima) and swaps, counted live'
  best: 'no swap on Already sorted'
  average: 'exactly C(n) = C(⌈n/2⌉) + C(⌊n/2⌋) + 1 + C(n − 1) comparisons on every input (test/plate-slowsort.test.ts, against the kernel); at most as many swaps as the input has inversions'
  worst: 'between n^(log n/(2+ε)) and n^(log n/2) (Broder and Stolfi): faster than any fixed power'
---

Multiply and surrender: to sort a range, slowsort both halves, move the larger of their two maxima to the end, then slowsort everything except the last key.

Broder and Stolfi introduced it in a parody of complexity theory that looks for the slowest reasonable method instead of the fastest. The decomposition is logically sound (sorting is finding the maximum and sorting the rest, and the maximum of a half is found by sorting it), but each problem becomes three barely smaller ones, and the call on all but one key makes the recursion as deep as n.

The recurrence T(n) = 2T(n/2) + T(n − 1) + 1 looks like mergesort's, yet it has no polynomial bound: Broder and Stolfi bound it between n^(log n/(2+ε)) and n^(log n/2). The count does not depend on the data, so every input costs the same, in contrast to bogosort, whose best case is linear. They also note that the number of inversions never increases during a run: slowsort never makes a wrong move, it only makes far too many.

This is a bespoke plate: the cost is superpolynomial, already millions of comparisons at n = 128, so the array engine's larger sizes could never finish. The plate caps n at 96 keys, lets the reader pick the input shape, and runs the kernel's recursion step by step on an explicit stack, drawing the calls that wait on it. The chart plots, on log-log axes, the comparisons the compiled kernel counts for every n up to the chosen one, the exact recurrence with the kernel's rounding of the halves, this run's count as it rises, and a power of n fitted to the smaller half of the sizes: the measured curve bends away above that line, which is what growing faster than any fixed power looks like. Start with Random permutation at the smallest sizes and step n up to feel the curve bend.
