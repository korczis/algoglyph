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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [lsd-radix-sort]
  objectives:
  - 'Read the Rounds readout at 512 keys: 6, two per base-16 digit of max − min = 511, the local histograms and the scatter.'
  - 'Read the Lanes readout: 4 processors, each counting and scattering its own block.'
  - 'Read the Comparisons readout: 0 on every input; the Array writes, 1,536, are 3n.'
  misconceptions:
  - 'The global prefix sum is a round of its own; it is the one step the plate''s processors do not run in parallel, so it shows as a phase without a round.'
algorithm:
  paradigm: iterative-refinement
  properties:
    stable: true
    in_place: false
    comparison_based: false
bounds:
  model: 'array writes (each pass writes every key back), auxiliary writes (the scatter''s output buffer), rounds (histograms and scatter) and lanes (four processors); no comparison'
  average: 'on every input of n ≥ 2 keys, for the d base-16 digits of max − min: 2d rounds, 4 lanes, d·n array writes, at most d·n auxiliary writes and no comparison; d(n + k) work is the published bound'
claims:
  - id: two-rounds-per-digit
    statement: >-
      On Random permutation at 512 keys parallel radix sort takes 6 rounds, a local histogram and a scatter for each of the 3 base-16 digits of the key range 511.
    readout: Rounds
    expect: { value: 6 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

LSD radix sort with every pass shared among p workers: each worker counts the digits of its share in a local histogram, one prefix sum over all histograms tells every worker where its elements with each digit go, and the elements are moved.

The order of that prefix sum is the whole trick: by digit value first, then by worker, then by input position within a worker. That keeps each pass stable, and stable passes are what make least-significant-digit radix sort correct at all.

The plate runs the workers' steps one after another and counts total work; it makes no key comparison, only digit reads and writes. Start with Random permutation at n = 256 and watch each pass regroup the keys by one digit into the auxiliary strip. The total work is of order d(n + k) for d digits of k values, as for sequential radix sort with counting sort per pass, plus order p k per pass for the histograms and prefix sums; it does the same work whatever the input order.

Every element moves d times, so on distributed machines starting from the most significant digit is often better: buckets small enough for one worker are handed over whole and finished locally. Radix sorting on vector multiprocessors and its place among the Connection Machine sorts were studied in 1991; it suits fixed-length integer keys on hardware with many simple units and fast prefix sums, such as vector processors and GPUs, while long keys or very skewed distributions favour samplesort.
