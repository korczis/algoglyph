---
id: tape-merge-sort
title: Tape mergesort
taxonomy: sorting/external
status: live
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "5.4 External sorting"
  - id: friend-1956
    ref: an early survey of tape sorting
  - id: betz-1959
    ref: cascade merging
  - id: gilstad-1960
    ref: polyphase merging
  - id: sobel-1962
    ref: oscillating sort
tags:
  - sorting
  - external sorting
  - merging
  - tapes
complexity: n log n comparisons in every case; about log₂ r passes for r initial runs; extra space n on tapes
related:
  - balanced-multiway-merge
  - external-merge-sort
  - replacement-selection
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [mergesort-bottom-up]
  objectives:
  - 'Read the Passes readout at 512 keys: 11, run generation and then a distribution and a merge for each of the ⌈lg 23⌉ = 5 halvings of the 23 runs.'
  - 'Run Already sorted at 512 keys: 12n = 6,144 auxiliary writes, n per pass and n for the memory loads, every pass moving every key.'
  - 'Explain why half the passes are pure copying, and what a fourth tape saves.'
  misconceptions:
  - 'A tape merge pass is one pass over the data; with three tapes each halving costs two, a distribution and a merge, so 23 runs take 2·5 + 1 = 11 passes, not the 6 of merging alone.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
bounds:
  model: 'comparisons (memory sorts and two-way merges), array writes (the sorted file written once), auxiliary writes (memory and tapes A, B, C) and passes (run generation, every distribution and every merge)'
  best: 'on Already sorted (n − r) + the merges'' comparisons, those of a two-way external mergesort, and (passes + 1)·n auxiliary writes'
  average: 'on every input of n ≥ 2 keys 1 + 2⌈lg r⌉ passes for r = ⌈n/M⌉ runs, 11 at 512 keys, and n array writes; comparisons at most the memory sorts'' bound plus n⌈lg r⌉'
claims:
  - id: eleven-passes
    statement: >-
      On Random permutation at 512 keys the three-tape merge takes 11 passes: run generation, then a distribution and a merge for each of the five halvings of its 23 runs.
    readout: Passes
    expect: { value: 11 }
    setup:
      params: { shape: random, n: 512 }
  - id: passes-at-memory-64
    statement: >-
      At 512 keys a memory of M = 64 leaves 8 runs on tape A, and each of the three halvings costs a distribution and a merge, seven passes in all: 1 + 2⌈log₂ 8⌉.
    readout: Passes
    expect: { value: 7 }
    setup:
      params: { shape: random, n: 512, memory: 64 }
---

The oldest external sort: tapes allow only sequential reading and writing, so sort memory loads into runs, spread the runs over tapes, and merge runs from several tapes onto others, pass after pass, until one run is left.

The plate runs the classic three-tape straight merge: runs are written to one tape, each pass first distributes them alternately to the other two tapes and then merges them back pairwise, halving their number. The tapes appear in the auxiliary strip, and the readouts count element operations and the passes over the data: run generation, then every distribution and every merge, each of which reads and writes every key once. Start with Random permutation at n = 256 and notice the distribution copy before every merge: the pure overhead that more tapes avoid.

With r initial runs and a k-way merge, about log_k r passes are needed and each reads and writes all the data, so both a larger fan-in and longer initial runs pay: replacement selection makes runs longer, more tapes raise k. Comparisons total n log n. Merging always takes runs that were neighbours in the input, so with ties going to the earlier run the result is stable, which schedules like polyphase merging cannot keep.

Friend surveyed tape sorting in 1956; the schedules that cut passes or tapes followed within a few years: cascade merging, polyphase merging and the oscillating sort. Tapes are no longer used for sorting, but sequential-only processing, such as streaming, still meets the same arithmetic of passes.
