---
id: polyphase-merge-sort
title: Polyphase merge
taxonomy: sorting/external
status: live
engine: array
labs:
  - sorting
sources:
  - id: gilstad-1960
    ref: the original description
  - id: knuth-taocp-3
    ref: "5.4.2 The polyphase merge"
  - id: aggarwal-1988
    ref: the I/O lower bound no schedule beats
tags:
  - sorting
  - external sorting
  - merging
  - tapes
  - fibonacci
complexity: n log n comparisons in every case; extra space n on tapes
related:
  - balanced-multiway-merge
  - external-merge-sort
  - replacement-selection
  - tape-merge-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [tape-merge-sort]
  objectives:
  - 'Read the distribution at 512 keys: 23 runs need the Fibonacci level 7, [21, 13] runs on two tapes, 11 of them dummy.'
  - 'Count the merges of each phase in the Phase readout: 13, 8, 5, 3, 2, 1, 1, Fibonacci numbers falling to the last merge.'
  - 'Read the Phase readout at the end: level + 3 = 10, run generation, distribution, seven merge phases and the final write.'
  misconceptions:
  - 'Every polyphase phase is a pass over all the data; a phase merges only as many runs as the shorter input tape holds, so the plate shows phases and no whole pass.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: false
bounds:
  model: 'comparisons (memory sorts and two-way merges), array writes (the sorted file written once), auxiliary writes (memory and the three tapes) and phases; no whole pass'
  average: 'on every input of n ≥ 2 keys n array writes and level + 3 phases, level the smallest l whose Fibonacci distribution of order 2 holds the r = ⌈n/M⌉ runs (7 at 512 keys); the merges of the phases are Fibonacci numbers, and comparisons are at most the memory sorts'' bound plus n per merge phase'
claims:
  - id: fibonacci-phases
    statement: >-
      On Random permutation at 512 keys polyphase merging takes 10 phases: run generation, the distribution of 23 runs as [21, 13] with 11 dummies, seven merge phases of 13, 8, 5, 3, 2, 1 and 1 merges, and the final write.
    readout: Phase
    expect: { value: 10 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Tape sorting without idle output tapes: spread the runs unevenly over all tapes but one, merge one run from each onto the empty tape until an input tape runs dry, and let that tape be the next output.

The uneven spread is exact. Working back from the single final run shows that the perfect distributions are generalised Fibonacci numbers of order T − 1 for T tapes; with three tapes they are the ordinary Fibonacci numbers (8 and 5 runs, then 5 and 3, and so on). When the number of runs is not perfect, empty dummy runs fill the gap.

Each phase reads only part of the data, which is where the saving over balanced merging comes from; asymptotically no tape schedule beats the general bound Θ((N/B) log_{M/B}(N/B)) on block transfers. The plate simulates the tapes in the auxiliary strip and counts element operations; passes and tape traffic are the model in these notes. Start with Random permutation at n = 256 and watch one tape drain at the end of every phase while the empty one fills.

Comparisons total n log n regardless of input. Polyphase merging is not stable: it merges runs that were never neighbours in the input, so equal keys from distant parts lose their order unless a sequence number is attached. It made sense for a handful of tape drives; on disks, plain multiway merging with a large fan-in replaces it.
