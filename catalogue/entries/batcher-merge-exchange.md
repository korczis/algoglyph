---
id: batcher-merge-exchange
title: Batcher's merge exchange
taxonomy: sorting/networks
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - sorting network
  - parallel
  - oblivious
  - in-place
complexity: O(n log² n) compare-exchanges, fixed in advance
related:
  - perfect-shuffle-merge
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [mergesort-top-down]
  objectives:
  - 'Run Already sorted and Random permutation at 512 keys: 9,727 comparisons on both, (k² − k + 4)·2^(k−2) − 1 for n = 2^k, and no write on Already sorted.'
  - 'Compare with bitonic sort in the lab: fewer comparators at every power of two from 4 keys on, 9,727 against 11,520 at 512 keys.'
  - 'Explain why a fixed network that sorts every input of zeros and ones sorts every input (the zero-one principle).'
  misconceptions:
  - 'A network only works for a power-of-two n; the merge exchange runs at every n, 1,077 comparators at 100 keys where the 128-key network has 1,471.'
algorithm:
  properties:
    stable: false
bounds:
  model: 'comparisons (one per comparator) and array writes (two per exchange); no auxiliary write'
  average: 'the same comparators on every input of n keys: (k² − k + 4)·2^(k−2) − 1 at n = 2^k, 9,727 at 512 keys, and as many as Parberry''s pairwise network at every n up to 1,024; no write on Already sorted'
claims:
  - id: same-comparisons-on-sorted-input
    statement: >-
      On Already sorted at 512 keys the merge exchange makes the 9,727 comparisons it makes on every input of that size, (k² − k + 4)·2^(k−2) − 1 for k = 9: the schedule does not depend on the keys.
    readout: Comparisons
    expect: { value: 9727 }
    setup:
      params: { shape: sorted, n: 512 }
---

Batcher's odd-even merge exchange: a fixed schedule of compare-exchanges that sorts any input.

The sequence of comparisons does not depend on the keys, which is what makes it a network: every compare-exchange of one round could run on its own processor.

Try Already sorted: it performs exactly the same comparisons as on random input.
