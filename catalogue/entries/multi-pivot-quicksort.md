---
id: multi-pivot-quicksort
title: Quicksort, multi-pivot
taxonomy: sorting/quicksort
status: live
engine: array
labs:
  - sorting
sources:
  - id: kushagra-2014
    ref: the three-pivot algorithm and its cache analysis
  - id: aumuller-2016
    ref: comparison-optimal multi-pivot partitioning
  - id: aumuller-2015
    ref: the dual-pivot lower bound
tags:
  - sorting
  - quicksort
  - partitioning
  - in-place
  - multiple pivots
complexity: n log n best, n log n average, n² worst; extra space log n
related:
  - proportion-extend-sort
  - quicksort
---

Choose k pivots, sort them, and partition the subarray into k + 1 parts by which pair of pivots each key falls between; this plate runs the three-pivot version, which splits into four parts in a single pass.

The kernel follows Kushagra, López-Ortiz, Qiao and Munro: four indices, two moving right and two moving left, and the quartile keys as pivots. With three pivots a key is classified with two comparisons, first against the middle pivot and then against one of the outer ones. Their argument for the scheme is not fewer comparisons but fewer cache misses than one- or two-pivot partitioning.

The theory agrees with that reading. For comparison-optimal strategies, Aumüller, Dietzfelbinger and Klaue found the gain from more pivots in comparisons to be marginal, and worse than simply taking the median of a sample as one pivot; counted by array accesses, three to five pivots do best, which matches the measured times, though the improvement over known algorithms is small.

Start with Random permutation at n = 256 and compare the reads and writes, not just the comparisons, with dual-pivot quicksort in the lab. The worst case remains quadratic and the partition is not stable. With very many pivots drawn from a large sample the method turns into samplesort.
