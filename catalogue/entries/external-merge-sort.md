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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [k-way-merge-sort]
  objectives:
  - 'Read the Passes readout at 512 keys: 4, one for run generation (23 runs of at most M = 23 keys) and three 4-way merge passes, 23 runs to 6, 2 and 1.'
  - 'Compute 1 + ⌈log₄ ⌈n/M⌉⌉ for any n on the slider and check it against the plate: 3 passes at 256 keys.'
  - 'Run Already sorted at 512 keys: n array writes as on every input, but only 2,260 comparisons, because a memory load whose halves are in order is not merged.'
  misconceptions:
  - 'Presorted input saves passes; the pass count depends on n alone, 4 at 512 keys on every input, and only the comparisons fall, 2,260 on Already sorted against 5,240 on Random.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
bounds:
  model: 'comparisons (in the memory sorts and the merges'' head scans), array writes (the sorted file written once), auxiliary writes (memory and the runs on disk) and passes (run generation and every merge pass); memory M = max(4, ⌈√n⌉) keys, fan-in 4'
  best: 'on Already sorted (n − r) + the head scans'' comparisons for r = ⌈n/M⌉ runs, 2,260 at 512 keys, and 2n auxiliary writes'
  average: 'on every input of n ≥ 2 keys 1 + ⌈log₄ r⌉ passes and n array writes; comparisons at most the memory sorts'' bound plus 3n per merge pass, auxiliary writes at most n(passes + 2); the I/O bound Θ((N/B) log_{M/B}(N/B)) is Aggarwal and Vitter''s, in block transfers the plate does not count'
claims:
  - id: four-passes
    statement: >-
      On Random permutation at 512 keys external mergesort takes 4 passes: run generation makes 23 runs of at most M = 23 keys, and 4-way merging cuts them to 6, 2 and 1, so 1 + ⌈log₄ 23⌉ = 4.
    readout: Passes
    expect: { value: 4 }
    setup:
      params: { shape: random, n: 512 }
---

Sort a file larger than memory in two phases: cut it into memory-sized pieces, sort each one into a run on disk, then merge k runs at a time in passes until a single run is left.

What counts here is not comparisons but block transfers between memory and disk. In the model of Aggarwal and Vitter, a memory holds M records, the disk moves blocks of B, and sorting N records needs Θ((N/B) log_{M/B}(N/B)) transfers; merging with a fan-in close to M/B meets that bound, because each pass reads and writes every record once and cuts the number of runs by the fan-in.

The plate simulates such a machine on the array: the memory is a small fraction of the keys, the runs on disk appear in the auxiliary strip after every pass, and the readouts count element operations. Block transfers are the model in these notes; the passes over the data, run generation included, are counted in the readouts. Start with Random permutation at n = 256 and count the passes; then raise the fan-in in your head: each extra way of merging removes a pass, which is the whole point of multiway merging.

On Random permutation the comparisons add up to about n log n, since run formation costs about N log M and the passes N log(N/M). The plate's memory sort skips a merge whose halves are already in order, so on Already sorted run formation costs only n − r comparisons for r runs, and the whole sort 2,260 at 512 keys against 5,240 on Random. The passes ignore presortedness, 4 at 512 keys on every input; replacement selection makes runs longer and so saves passes, and the length of the runs has a literature of its own. The sort is stable when runs are formed stably and ties go to the earlier run.
