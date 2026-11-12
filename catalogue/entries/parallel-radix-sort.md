---
id: parallel-radix-sort
title: Radix sort, parallel
taxonomy: sorting/parallel
status: live
engine: array
labs:
  - sorting
sources:
  - id: sanders-2019
    ref: "Chapter 5: Sorting and Selection"
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
  - id: zagha-1991
    ref: radix sort on vector multiprocessors
  - id: blelloch-1991
    ref: radix sort among the Connection Machine sorts
  - id: satish-2009
    ref: the GPU radix sort
tags:
  - sorting
  - parallel
  - stable
  - non-comparison
  - radix
  - prefix sums
complexity: d (n + k) in every case; extra space n + p k
related:
  - lsd-radix-sort
  - msd-radix-sort
---

LSD radix sort with every pass shared among p workers: each worker counts the digits of its share in a local histogram, one prefix sum over all histograms tells every worker where its elements with each digit go, and the elements are moved.

The order of that prefix sum is the whole trick: by digit value first, then by worker, then by input position within a worker. That keeps each pass stable, and stable passes are what make least-significant-digit radix sort correct at all.

The plate runs the workers' steps one after another and counts total work; it makes no key comparison, only digit reads and writes. Start with Random permutation at n = 256 and watch each pass regroup the keys by one digit into the auxiliary strip. The total work is of order d(n + k) for d digits of k values, as for sequential radix sort with counting sort per pass, plus order p k per pass for the histograms and prefix sums; it does the same work whatever the input order.

Every element moves d times, so on distributed machines starting from the most significant digit is often better: buckets small enough for one worker are handed over whole and finished locally. Radix sorting on vector multiprocessors and its place among the Connection Machine sorts were studied in 1991; it suits fixed-length integer keys on hardware with many simple units and fast prefix sums, such as vector processors and GPUs, while long keys or very skewed distributions favour samplesort.
