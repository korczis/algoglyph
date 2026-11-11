---
id: sort-tapestry
title: Sort Tapestry
taxonomy: sorting/overview
status: live
engine: custom
tags:
  - sorting
  - generators
  - permutations
complexity: see the algorithm
---

Every row is its own shuffled spectrum, sorted in lockstep by one algorithm: its fingerprint is woven into the cloth.

Each row holds a permutation of n values coloured along the palette. All rows run the same algorithm from different shuffles, advancing the same number of operations per frame.

Quadratic sorts drift like sand; quicksort tears the cloth into blocks; heapsort first arranges the heap, a rough slope from the largest values at the left edge, then peels it from the right; radix never compares at all and sorts by base-4 digit, four passes for up to 256 values.

The readout counts comparisons and writes exactly as the generators perform them, averaged over the rows.
