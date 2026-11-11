---
id: tape-merge-sort
title: Tape mergesort
taxonomy: sorting/external
status: planned
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
---

The oldest external sort: tapes allow only sequential reading and writing, so sort memory loads into runs, spread the runs over tapes, and merge runs from several tapes onto others, pass after pass, until one run is left.

The plate runs the classic three-tape straight merge: runs are written to one tape, each pass first distributes them alternately to the other two tapes and then merges them back pairwise, halving their number. The tapes appear in the auxiliary strip and the readouts count element operations; passes over the tapes are the model in these notes. Start with Random permutation at n = 256 and notice the distribution copy before every merge: the pure overhead that more tapes avoid.

With r initial runs and a k-way merge, about log_k r passes are needed and each reads and writes all the data, so both a larger fan-in and longer initial runs pay: replacement selection makes runs longer, more tapes raise k. Comparisons total n log n. Merging always takes runs that were neighbours in the input, so with ties going to the earlier run the result is stable, which schedules like polyphase merging cannot keep.

Friend surveyed tape sorting in 1956; the schedules that cut passes or tapes followed within a few years: cascade merging, polyphase merging and the oscillating sort. Tapes are no longer used for sorting, but sequential-only processing, such as streaming, still meets the same arithmetic of passes.
