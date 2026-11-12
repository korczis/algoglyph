---
id: two-phase-multiway-merge-sort
title: Two-phase multiway mergesort
taxonomy: sorting/external
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [external-merge-sort]
  objectives:
  - 'Read the Passes readout: 2 at every size, run generation and one merge of all the sublists.'
  - 'Read the second phase at 512 keys: a memory of 2M = 46 keys makes 12 sublists, merged at once with blocks of B = ⌊46/13⌋ = 3 keys.'
  - 'Run Already sorted at 512 keys: 4n = 2,048 auxiliary writes, each key loaded into memory, written to its sublist, read into an input buffer and moved to the output block once.'
  misconceptions:
  - 'Merging all runs at once is free; the head scan compares the live heads of all 12 sublists, so at 512 keys the merge makes 8,073 comparisons on Random, more than the 5,240 of four-way external mergesort, in half its passes.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
bounds:
  model: 'comparisons (memory sorts and the head scan of the merge), array writes (the output blocks written to the file), auxiliary writes (memory, sublists, input buffers and output block) and passes; memory 2M = 2·max(4, ⌈√n⌉) keys, blocks B = max(1, ⌊2M/(r + 1)⌋) for r sublists'
  best: 'on Already sorted (n − r) + Σᵢ Lᵢ(r − i) comparisons for the sublist lengths Lᵢ, 3,536 at 512 keys, and exactly 4n auxiliary writes'
  average: 'on every input of n ≥ 2 keys 2 passes and n array writes; comparisons at most the memory sorts'' bound plus (r − 1)·n, auxiliary writes at most 5n; about 4N/B block transfers is the I/O model''s count, not a readout'
claims:
  - id: two-passes
    statement: >-
      On Random permutation at 512 keys the two-phase mergesort takes 2 passes, where four-way external mergesort takes 4: its 12 sublists of 46 keys fit into memory one block each and are merged at once.
    readout: Passes
    expect: { value: 2 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

External mergesort with exactly one merging pass: phase 1 sorts memory loads into runs, phase 2 merges all of the runs at once with one input block per run and one output block in memory.

The condition is that a block of every run fits in memory at the same time. With about N/M runs and room for M/B blocks, that means N ≤ M²/B roughly. Because M/B is large in practice, that ceiling is far above memory itself, so two phases handle inputs many times larger than memory.

Each record is read and written once per phase, about 4N/B block transfers in all, 3N/B if the output is streamed onward instead of written back. In the general bound Θ((N/B) log_{M/B}(N/B)) the logarithm is at most 2 here, so the cost is linear in transfers. The plate simulates the buffers and the output block in the auxiliary strip and counts element operations; the transfers are the model in these notes. Start with Random permutation at n = 256 and watch the second phase pull the smallest head from every run in turn.

The name is common in database teaching; who first used it is not documented in these sources. When there are more runs than buffers, a further pass is needed and the method becomes general external mergesort. Comparisons total n log n in every case; stability follows when the first phase sorts stably and ties go to the earlier run.
