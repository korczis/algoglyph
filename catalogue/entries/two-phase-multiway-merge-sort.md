---
id: two-phase-multiway-merge-sort
title: Two-phase multiway mergesort
taxonomy: sorting/external
status: planned
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "5.4.1 Multiway merging"
  - id: vitter-2008
    ref: when one merging pass is enough
  - id: aggarwal-1988
    ref: the I/O lower bound
  - id: larson-2003
    ref: longer runs widen the range of two phases
tags:
  - sorting
  - external sorting
  - merging
  - runs
complexity: n log n comparisons in every case; about 4N/B block transfers when N ≤ M²/B; extra space n
related:
  - balanced-multiway-merge
  - external-merge-sort
  - k-way-merge-sort
  - replacement-selection
  - tournament-sort
---

External mergesort with exactly one merging pass: phase 1 sorts memory loads into runs, phase 2 merges all of the runs at once with one input block per run and one output block in memory.

The condition is that a block of every run fits in memory at the same time. With about N/M runs and room for M/B blocks, that means N ≤ M²/B roughly. Because M/B is large in practice, that ceiling is far above memory itself, so two phases handle inputs many times larger than memory.

Each record is read and written once per phase, about 4N/B block transfers in all, 3N/B if the output is streamed onward instead of written back. In the general bound Θ((N/B) log_{M/B}(N/B)) the logarithm is at most 2 here, so the cost is linear in transfers. The plate simulates the buffers and the output block in the auxiliary strip and counts element operations; the transfers are the model in these notes. Start with Random permutation at n = 256 and watch the second phase pull the smallest head from every run in turn.

The name is common in database teaching; who first used it is not documented in these sources. When there are more runs than buffers, a further pass is needed and the method becomes general external mergesort. Comparisons total n log n in every case; stability follows when the first phase sorts stably and ties go to the earlier run.
