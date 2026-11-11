---
id: psrs
title: Parallel sorting by regular sampling
taxonomy: sorting/parallel
status: planned
engine: array
labs:
  - sorting
sources:
  - id: shi-1992
    ref: the original algorithm and its load-balance bound
  - id: sanders-2019
    ref: comparison with random sampling
tags:
  - sorting
  - parallel
  - regular sampling
  - multiway merge
complexity: n log n in every case; extra space n
related:
  - parallel-samplesort
  - samplesort
---

PSRS: every processor sorts its own block first and takes samples at regular intervals; the gathered samples give p − 1 pivots; every processor cuts its already sorted block at the pivots, sends piece i to processor i, and merges the sorted pieces it receives.

Taking the sample from locally sorted data is what replaces chance. Shi and Schaeffer proved that, without repeated keys, no processor receives much more than about twice its ideal share n/p, whatever the distribution of the input; a random sample guarantees balance only with high probability. The total work is on the order of n log n for every input: local sorting, sorting the p² samples, and a p-way merge at the end.

The plate runs the processors in one thread, one after another, and counts the total work; the phases (local sort, sampling, pivots, partition, exchange, merge) appear in order. Start with Random permutation at n = 128 (the kernel's default is four processors) and compare the received pieces: none is far from the ideal share. Then try Few distinct keys, where the guarantee no longer applies because it assumes distinct keys.

It suits moderate processor counts, multicore machines and small clusters, where predictable behaviour without randomness matters and both expensive phases, the local sort and the merge, are sequential work on local, cache-friendly data. Sorting p² samples on one processor becomes the bottleneck as p grows; with thousands of processors a random sample sorted in parallel, or a multilevel samplesort, is the better choice. It is not stable.
