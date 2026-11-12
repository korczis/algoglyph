---
id: quickselect
title: Quickselect
taxonomy: sorting/selection
status: live
engine: array
labs: []
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - selection
  - partitioning
  - k-th smallest
  - linear time
complexity: linear on average
related:
  - quicksort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [quicksort]
  objectives:
  - 'Run Already sorted at 64 keys with k at 50 %: 1,617 comparisons, Σ (m + 1) for m = 32..64, since the rightmost pivot is always the largest key left and each partition removes one key above rank k.'
  - 'Set k to 0 % and run Reversed: n comparisons and 2 array writes, one partition, because the first pivot is the smallest key and lands at index 0 at once.'
  - 'Read the Result row: a[k] is the (k + 1)-th smallest, every key left of it no larger and every key right of it no smaller, while the rest stays unsorted.'
  misconceptions:
  - 'Finding the median means sorting first; over 400 Random permutations of 512 keys quickselect averages 3.31n comparisons for the median, about 1,700, below the n lg n = 4,608 a sort would need.'
algorithm:
  paradigm: divide-and-conquer
  postconditions:
    - a[k] holds the (k + 1)-th smallest key; no key left of index k is larger and no key right of it is smaller.
  limitations:
    - The rightmost key is the pivot, so Already sorted and Reversed input can cost a quadratic number of comparisons.
bounds:
  model: 'comparisons (each partition scans its range against the rightmost key) and array writes (exchanges, two each)'
  best: 'Reversed with k = 0: n comparisons and 2 array writes'
  average: 'linear (Sedgewick); over Random permutations of 512 keys, seeds 1 to 400, a mean of 1.94n comparisons for k = 0 and 3.31n for the median; on Already sorted Σ (m + 1) over m = max(k + 1, 2)..n comparisons and 2(n − max(k, 1)) array writes'
  worst: 'a partition of m keys at most m + 1 comparisons, so at most (n − 1)(n + 4)/2 in all for every k, on Already sorted with k = 0; Reversed with the median comes close, 131,582 against 131,838 at 512 keys'
claims:
  - id: sorted-input-one-key-per-partition
    statement: >-
      On Already sorted at 64 keys with k at 50 % quickselect makes 1,617 comparisons, Σ (m + 1) for m = 32..64: every partition's pivot is the largest key left, so each removes one key above rank k.
    readout: Comparisons
    expect: { value: 1617 }
    setup:
      params: { shape: sorted, n: 64, k: 50 }
---

Partition, then continue only in the side that holds rank k.

The band never returns to the other side, and the first partition leaves on average about half of it for the smallest key and about three quarters for the median, so the total work is linear, not n lg n: over Random permutations of 512 keys the plate's kernel averages about 1.94n comparisons for the smallest key and 3.31n for the median.

When it stops, every key left of index k is no larger and every key right of it no smaller; the readout checks a[k] against the sorted input.
