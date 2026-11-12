---
id: quicksort-median-of-three
title: Quicksort, median-of-three with cutoff
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
  - median of three
  - insertion cutoff
complexity: about 1.19 n lg n compares on average
related:
  - quicksort
  - insertion-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [quicksort, insertion-sort]
  objectives:
  - 'Count Already sorted at 512 keys: 3,652 comparisons, where the rightmost pivot of plain quicksort needs 131,838, because every pivot is now the middle key.'
  - 'Read the Array writes on Already sorted: four for each subfile of more than 11 keys that is partitioned, none in the final insertion pass.'
  - 'Watch the final insertion pass sort blocks of at most eleven keys, each block already between its neighbours.'
  misconceptions:
  - 'Median-of-three makes the worst case n log n; an input built against the rule still costs more than n²/4 comparisons.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
bounds:
  model: 'comparisons and array writes (an exchange is two writes, a shift one)'
  average: '~1.19 n lg n comparisons on random keys; up to 11 keys only the insertion pass runs, so array writes = inversions + keys that move and inversions ≤ comparisons ≤ inversions + n − 1'
  worst: 'quadratic: more than n²/4 comparisons from 22 keys on, on the input an adversary builds against the median-of-three rule'
claims:
  - id: sorted-input-stays-below-n-lg-n
    statement: >-
      On Already sorted at 512 keys the median-of-three pivot keeps the comparisons below
      n lg n = 4,608, where the rightmost pivot of plain quicksort needs 131,838.
    readout: Comparisons
    expect: { below: 4608 }
    setup:
      params: { shape: sorted, n: 512 }
---

The pivot is the median of the first, middle and last keys; small subfiles are left for one final insertion sort.

Sorting the three sample keys also places sentinels at both ends of the subfile, so the partitioning scans need no bounds checks.

Watch the end of the run: the array is nearly sorted in blocks of up to eleven keys, and a single insertion pass finishes it.
