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
---

Samplesort with one bucket per processor: sample the distributed input, pick p − 1 splitters, let every processor classify its own keys among them, exchange the buckets in a single all-to-all step, and let each processor sort what it received.

Each key crosses the network once. Parallel quicksort or binary parallel merging move the data a logarithmic number of times, which is why samplesort usually wins on distributed-memory machines once each processor holds enough data. The total work stays on the order of n log n; a sample on the order of p log p keeps every bucket near n/p with high probability, and the parallel time is then on the order of (n/p) log n plus the cost of sorting the sample.

The plate simulates the processors in one thread, one after another, and counts the total work: the sample (eight keys per processor), the classification of every block, the exchange shown in the auxiliary strip, and the local sorts. The parallel time is prose from the sources, not a readout. Start with Random permutation at n = 128 (the kernel's default is four processors) and compare the sizes of the buckets the exchange delivers.

Unequal buckets do not change the total work but do change the finishing time, since the slowest processor decides when the sort ends; that is what the oversampling is for. In a comparison on the Connection Machine CM-2 samplesort came out fastest for large inputs. Regular sampling (PSRS) replaces the random sample with a deterministic one; with very many processors the number of messages per processor becomes the bottleneck and multilevel variants take over.
