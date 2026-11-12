---
id: parallel-samplesort
title: Samplesort, parallel
taxonomy: sorting/parallel
status: live
engine: array
labs:
  - sorting
sources:
  - id: sanders-2019
    ref: the algorithm and its parallel time
  - id: blelloch-1991
    ref: comparison on the Connection Machine CM-2
  - id: reif-1987
    ref: randomized logarithmic-time sorting by sampling
  - id: frazer-1970
    ref: the original sampling idea
  - id: shi-1992
    ref: the regular-sampling variant
tags:
  - sorting
  - parallel
  - splitters
  - all-to-all exchange
complexity: n log n in every case; extra space n
related:
  - samplesort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [samplesort]
  objectives:
  - 'Read the Rounds and Lanes readouts: 4 rounds (classify, exchange, local sort, concatenate) of 4 lanes at every size.'
  - 'Count the classification: exactly 2 comparisons per key, a binary search among the 3 splitters.'
  - 'Run Random permutation at 512 keys and compare the buckets the four processors receive in the auxiliary strip: 138, 144, 114 and 116 keys.'
  misconceptions:
  - 'A parallel sort moves the data once per level, like quicksort; the exchange moves every key once, and the rounds are the same 4 at 8 keys as at 512.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons (sample sort, classification, local merge sorts), array writes (the buckets concatenated), auxiliary writes (splitters and the processors'' buckets), rounds and lanes (four processors)'
  average: 'on every input of n ≥ 2 keys 4 rounds, 4 lanes, 5 phases, n array writes and exactly 2n comparisons in the classification; the (n/p) log n parallel time is the sources'''
claims:
  - id: four-rounds
    statement: >-
      On Random permutation at 512 keys parallel samplesort takes 4 rounds, classify, exchange, local sort and concatenate, the same four it takes at every size: each key crosses the exchange once.
    readout: Rounds
    expect: { value: 4 }
    setup:
      params: { shape: random, n: 512 }
---

Samplesort with one bucket per processor: sample the distributed input, pick p − 1 splitters, let every processor classify its own keys among them, exchange the buckets in a single all-to-all step, and let each processor sort what it received.

Each key crosses the network once. Parallel quicksort or binary parallel merging move the data a logarithmic number of times, which is why samplesort usually wins on distributed-memory machines once each processor holds enough data. The total work stays on the order of n log n; a sample on the order of p log p keeps every bucket near n/p with high probability, and the parallel time is then on the order of (n/p) log n plus the cost of sorting the sample.

The plate simulates the processors in one thread, one after another, and counts the total work: the sample (eight keys per processor), the classification of every block, the exchange shown in the auxiliary strip, and the local sorts. The parallel time is prose from the sources, not a readout. Start with Random permutation at n = 128 (the kernel's default is four processors) and compare the sizes of the buckets the exchange delivers.

Unequal buckets do not change the total work but do change the finishing time, since the slowest processor decides when the sort ends; that is what the oversampling is for. In a comparison on the Connection Machine CM-2 samplesort came out fastest for large inputs. Regular sampling (PSRS) replaces the random sample with a deterministic one; with very many processors the number of messages per processor becomes the bottleneck and multilevel variants take over.
