---
id: external-samplesort
title: External samplesort
taxonomy: sorting/external
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [samplesort, external-quicksort]
  objectives:
  - 'Follow the Phase readout at 512 keys: a sample of 12 keys gives 3 splitters, one distribution writes the part to 7 bucket files, and each bucket larger than M = 23 is distributed again.'
  - 'Run Few distinct keys at 512 keys: 1,971 comparisons against Random''s 6,102, since keys equal to a splitter land in a bucket that needs no further work.'
  - 'Count what one distribution costs per key: two comparisons among three splitters, and a third to test equality with the splitter found.'
  misconceptions:
  - 'A key that repeats very often keeps one bucket large forever; equal keys get a bucket of their own, so Few distinct keys at 512 keys needs only two distributions.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
bounds:
  model: 'comparisons (sample sort, classification among the splitters, memory sorts), array writes (each distribution writes its part back; an internal sort writes its part) and auxiliary writes (memory, splitters and bucket files); memory M = max(4, ⌈√n⌉), k = 4'
  average: 'on every input each distribution makes between 2 and 3 comparisons per key of its part, and the auxiliary writes are the array writes plus 3 splitters per distribution; log_{M/B}(N/B) passes with balanced buckets is the published I/O bound'
claims:
  - id: equal-keys-finish-early
    statement: >-
      On Few distinct keys at 512 keys external samplesort makes 1,971 comparisons, under a third of the 6,102 on Random permutation: keys equal to a splitter go to a bucket of their own that is never distributed again.
    readout: Comparisons
    expect: { value: 1971 }
    setup:
      params: { shape: few-unique, n: 512, speed: 2000 }
---

Multiway distribution for files: sort a random sample in memory, take evenly spaced splitters from it, send every record in one pass to the bucket file of its interval, and sort each bucket the same way until it fits in memory.

Memory must hold one output block per bucket, so the number of buckets S is bounded by about M/B. If the splitters divide evenly, each level shrinks the buckets S times, and with S proportional to M/B that is log_{M/B}(N/B) passes: the optimal bound of Aggarwal and Vitter. Each record is placed by binary search among the splitters, log S comparisons per level, n log n in total.

The plate sorts small parts in memory and shows the bucket files in the auxiliary strip; it counts element operations, while passes and transfers are the model in these notes. Start with Random permutation at n = 256, then Few distinct keys: no choice of splitters splits a key that repeats very often, so equal keys need a bucket of their own or one bucket stays large.

Guaranteeing balanced buckets is the hard part; Vitter and Shriver gave a randomised distribution sort for parallel disks that handles the sampling and the spread of blocks over the disks probabilistically. The idea of splitters from a sorted sample is Frazer and McKellar's samplesort; who first used the name for the external form is not documented here. The method is not specified as stable and is not in place; the plate's distribution keeps file order and its memory sort is stable, and no input its test tried had equal keys reordered.
