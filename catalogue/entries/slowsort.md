---
id: slowsort
title: Slowsort
taxonomy: sorting/esoteric
status: planned
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
---

Multiply and surrender: to sort a range, slowsort both halves, move the larger of their two maxima to the end, then slowsort everything except the last key.

Broder and Stolfi introduced it in a parody of complexity theory that looks for the slowest reasonable method instead of the fastest. The decomposition is logically sound (sorting is finding the maximum and sorting the rest, and the maximum of a half is found by sorting it), but each problem becomes three barely smaller ones, and the call on all but one key makes the recursion as deep as n.

The recurrence T(n) = 2T(n/2) + T(n − 1) + 1 looks like mergesort's, yet it has no polynomial bound: Broder and Stolfi bound it between n^(log n/(2+ε)) and n^(log n/2). The count does not depend on the data, so every input costs the same, in contrast to bogosort, whose best case is linear. They also note that the number of inversions never increases during a run: slowsort never makes a wrong move, it only makes far too many.

This is a bespoke plate: the cost is superpolynomial, already millions of comparisons at n = 128, so the array engine's larger sizes could never finish. The plate caps n at a few dozen keys, lets the reader pick the input shape, and shows the measured comparisons growing faster than any fixed power of n; start with Random permutation at the smallest sizes and step n up to feel the curve bend.
