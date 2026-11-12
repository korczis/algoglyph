---
id: psrs
title: Parallel sorting by regular sampling
taxonomy: sorting/parallel
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [parallel-samplesort, k-way-merge-sort]
  objectives:
  - 'Read the Rounds readout: 5, the phases every processor runs (local sort, sampling, partition, exchange, merge); sorting the p² = 16 samples is the one sequential phase.'
  - 'Run Random permutation at 512 keys and compare the keys each processor merges: 121, 135, 124 and 132, none far from 128.'
  - 'Run Already sorted at 512 keys: 512 array writes, all of them the final merge, since the local sorts find their blocks in order.'
  misconceptions:
  - 'Deterministic sampling needs a lucky input to balance; on every permutation the test tried at multiples of 16 keys up to 512 every processor received fewer than 2n/p keys.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons (local merge sorts, sample sort, partition searches, p-way merges), array writes (local sorts and the merged output), auxiliary writes (pivots and the processors'' merged pieces), rounds and lanes (four processors)'
  average: 'on every input of n ≥ 2 keys 5 rounds, 4 lanes, 6 phases and n + 3 auxiliary writes; regular sampling reads p keys of every non-empty block, p² = 16 at every size the plate offers; on Already sorted n array writes; on permutations of every multiple of 16 keys up to 512 tested, every processor''s share below 2n/p, as Shi and Schaeffer''s analysis bounds it for distinct keys'
claims:
  - id: sorted-blocks-written-once
    statement: >-
      On Already sorted at 512 keys PSRS makes 512 array writes, one per key: the local sorts find their blocks in order, and only the final merge writes every key to its place.
    readout: Array writes
    expect: { value: 512 }
    setup:
      params: { shape: sorted, n: 512, speed: 2000 }
---

PSRS: every processor sorts its own block first and takes samples at regular intervals; the gathered samples give p − 1 pivots; every processor cuts its already sorted block at the pivots, sends piece i to processor i, and merges the sorted pieces it receives.

Taking the sample from locally sorted data is what replaces chance. Shi and Schaeffer proved that, without repeated keys, no processor receives much more than about twice its ideal share n/p, whatever the distribution of the input; a random sample guarantees balance only with high probability. The total work is on the order of n log n for every input: local sorting, sorting the p² samples, and a p-way merge at the end.

The plate runs the processors in one thread, one after another, and counts the total work; the phases (local sort, sampling, pivots, partition, exchange, merge) appear in order. Start with Random permutation at n = 128 (the kernel's default is four processors) and compare the received pieces: none is far from the ideal share. Then try Few distinct keys, where the guarantee no longer applies because it assumes distinct keys.

It suits moderate processor counts, multicore machines and small clusters, where predictable behaviour without randomness matters and both expensive phases, the local sort and the merge, are sequential work on local, cache-friendly data. Sorting p² samples on one processor becomes the bottleneck as p grows; with thousands of processors a random sample sorted in parallel, or a multilevel samplesort, is the better choice. PSRS is not specified as stable; the plate's merge gives ties to the lower processor, and no input its test tried had equal keys reordered.
