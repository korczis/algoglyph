---
id: polyphase-merge-sort
title: Polyphase merge
taxonomy: sorting/external
status: planned
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
---

Tape sorting without idle output tapes: spread the runs unevenly over all tapes but one, merge one run from each onto the empty tape until an input tape runs dry, and let that tape be the next output.

The uneven spread is exact. Working back from the single final run shows that the perfect distributions are generalised Fibonacci numbers of order T − 1 for T tapes; with three tapes they are the ordinary Fibonacci numbers (8 and 5 runs, then 5 and 3, and so on). When the number of runs is not perfect, empty dummy runs fill the gap.

Each phase reads only part of the data, which is where the saving over balanced merging comes from; asymptotically no tape schedule beats the general bound Θ((N/B) log_{M/B}(N/B)) on block transfers. The plate simulates the tapes in the auxiliary strip and counts element operations; passes and tape traffic are the model in these notes. Start with Random permutation at n = 256 and watch one tape drain at the end of every phase while the empty one fills.

Comparisons total n log n regardless of input. Polyphase merging is not stable: it merges runs that were never neighbours in the input, so equal keys from distant parts lose their order unless a sequence number is attached. It made sense for a handful of tape drives; on disks, plain multiway merging with a large fan-in replaces it.
