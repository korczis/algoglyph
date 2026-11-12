---
id: external-merge-sort
title: External mergesort
taxonomy: sorting/external
status: live
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "5.4 External sorting"
  - id: aggarwal-1988
    ref: the I/O model and its lower bound
  - id: vitter-2008
    ref: merging and distribution as the external paradigms
  - id: graefe-2006
    ref: sorting inside database systems
  - id: larson-2003
    ref: run formation
  - id: frigo-1999
    ref: funnelsort, the same bound without knowing M and B
tags:
  - sorting
  - external sorting
  - merging
  - runs
complexity: n log n comparisons in every case; I/O optimal with (N/B) log_{M/B}(N/B) block transfers; extra space n
motivation: Databases sort query results, build indexes and run merge joins this way whenever the data outgrow memory.
related:
  - balanced-multiway-merge
  - k-way-merge-sort
  - mapreduce-sort
  - mergesort-bottom-up
  - mergesort-top-down
  - replacement-selection
  - terasort
---

Sort a file larger than memory in two phases: cut it into memory-sized pieces, sort each one into a run on disk, then merge k runs at a time in passes until a single run is left.

What counts here is not comparisons but block transfers between memory and disk. In the model of Aggarwal and Vitter, a memory holds M records, the disk moves blocks of B, and sorting N records needs Θ((N/B) log_{M/B}(N/B)) transfers; merging with a fan-in close to M/B meets that bound, because each pass reads and writes every record once and cuts the number of runs by the fan-in.

The plate simulates such a machine on the array: the memory is a small fraction of the keys, the runs on disk appear in the auxiliary strip after every pass, and the readouts count element operations. Block transfers are the model in these notes; the passes over the data, run generation included, are counted in the readouts. Start with Random permutation at n = 256 and count the passes; then raise the fan-in in your head: each extra way of merging removes a pass, which is the whole point of multiway merging.

Comparisons add up to n log n whatever the input, since run formation costs about N log M and the passes N log(N/M). The basic form ignores presortedness; replacement selection makes runs longer and so saves passes, and the length of the runs has a literature of its own. The sort is stable when runs are formed stably and ties go to the earlier run.
