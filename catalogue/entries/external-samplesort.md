---
id: external-samplesort
title: External samplesort
taxonomy: sorting/external
status: planned
engine: array
labs:
  - sorting
sources:
  - id: vitter-2008
    ref: distribution sort with sampled splitters
  - id: aggarwal-1988
    ref: optimality of multiway distribution
  - id: vitter-1994
    ref: randomised distribution over parallel disks
  - id: frazer-1970
    ref: samplesort, the in-memory original
tags:
  - sorting
  - external sorting
  - splitters
  - sampling
complexity: n log n comparisons in every case; log_{M/B}(N/B) passes with balanced buckets; extra space n
related:
  - external-merge-sort
  - external-quicksort
  - external-radix-sort
  - samplesort
  - two-phase-multiway-merge-sort
---

Multiway distribution for files: sort a random sample in memory, take evenly spaced splitters from it, send every record in one pass to the bucket file of its interval, and sort each bucket the same way until it fits in memory.

Memory must hold one output block per bucket, so the number of buckets S is bounded by about M/B. If the splitters divide evenly, each level shrinks the buckets S times, and with S proportional to M/B that is log_{M/B}(N/B) passes: the optimal bound of Aggarwal and Vitter. Each record is placed by binary search among the splitters, log S comparisons per level, n log n in total.

The plate sorts small parts in memory and shows the bucket files in the auxiliary strip; it counts element operations, while passes and transfers are the model in these notes. Start with Random permutation at n = 256, then Few distinct keys: no choice of splitters splits a key that repeats very often, so equal keys need a bucket of their own or one bucket stays large.

Guaranteeing balanced buckets is the hard part; Vitter and Shriver gave a randomised distribution sort for parallel disks that handles the sampling and the spread of blocks over the disks probabilistically. The idea of splitters from a sorted sample is Frazer and McKellar's samplesort; who first used the name for the external form is not documented here. It is neither stable nor in place.
