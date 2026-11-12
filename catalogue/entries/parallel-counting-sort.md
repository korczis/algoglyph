---
id: parallel-counting-sort
title: Counting sort, parallel
taxonomy: sorting/parallel
status: live
engine: array
labs:
  - sorting
sources:
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
  - id: sanders-2019
    ref: "Chapter 5: Sorting and Selection"
  - id: zagha-1991
    ref: per-processor counters on vector multiprocessors
tags:
  - sorting
  - parallel
  - stable
  - non-comparison
  - counting
  - prefix sums
complexity: n + k in every case; extra space n + p k
related:
  - bucket-sort
  - counting-sort
  - enumeration-sort
  - parallel-radix-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites: [counting-sort]
  objectives:
  - 'Read the Rounds readout: 2 on every input, the local counts and the scatter; the prefix sum between them is a phase without a round.'
  - 'Read the Array writes and Auxiliary writes: exactly n each, every key scattered once and written back once.'
  - 'Read the Comparisons readout: 0.'
  misconceptions:
  - 'More processors means more passes over the data; each processor counts and scatters only its own block, so the rounds are 2 at every size.'
algorithm:
  properties:
    stable: true
    in_place: false
    comparison_based: false
bounds:
  model: 'array writes, auxiliary writes (the scatter''s output), rounds and lanes (four processors); the count tables are not drawn; no comparison'
  average: 'on every input of n ≥ 2 keys 2 rounds, 4 lanes, exactly n array writes and n auxiliary writes, no comparison; n + pk work and n/p + k + log p time are the sources'''
claims:
  - id: n-auxiliary-writes
    statement: >-
      On Random permutation at 512 keys parallel counting sort makes 512 auxiliary writes, one per key: every processor scatters each key of its block to its slot once.
    readout: Auxiliary writes
    expect: { value: 512 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Key-indexed counting split among p workers: each worker builds a histogram of its share, one prefix sum over all histograms (by key value, then by worker) gives every worker the start of its slots for each key, and each worker writes its elements there without coordinating with the others.

Separate counters per worker are the point: a single shared table would have every worker updating the same counters at once, and those updates would serialise the computation. Walking its share in input order and filling consecutive slots, each worker keeps equal keys in their original order, so the result is stable.

The plate runs the workers' steps one after another and counts total work: order n + p k, a linear pass plus histograms and the prefix sum over them, which for a fixed number of workers is the n + k of sequential counting sort. No key is ever compared. Start with Few distinct keys at n = 128, where the histograms are small and the stable runs of equal keys are easy to follow; then Random permutation shows the cost of a key range as large as n.

The parallel time is of order n/p + k + log p, the last two terms coming from the vector prefix sum. Global numbering by prefix sum also balances a skewed input naturally: each worker receives at most ⌈n/p⌉ elements whatever the distribution. It pays off when the key range k is small next to n; for large ranges the p k counters become too many, and parallel radix sort splits the key into digits instead.
