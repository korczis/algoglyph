---
id: perfect-shuffle-merge
title: Merging with perfect shuffles
taxonomy: sorting/networks
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic-1990
    ref: Advanced Topics
tags:
  - sorting network
  - parallel
  - shuffle
  - oblivious
complexity: O(n log² n) compare-exchanges, fixed in advance
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [batcher-merge-exchange]
  objectives:
  - 'Run Already sorted at 256 keys: 3,839 comparisons, Batcher''s (k² − k + 4)·2^(k−2) − 1 for n = 2^k, and n·k(k − 1) = 14,336 auxiliary writes for the shuffles, with as many array writes.'
  - 'Run Random permutation at 256 keys: the same comparisons, and two more array writes for every exchange.'
  - 'Explain how a compare-exchange that meets a pad of the padded network is settled without a comparison.'
  misconceptions:
  - 'Shuffles are free wiring, so the plate shows no work for them; carried out through the auxiliary array they cost 14,336 auxiliary writes at 256 keys, more than three times the 3,839 comparisons.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
bounds:
  model: 'comparisons (one per compare-exchange of two real keys), array writes (the shuffled blocks written back, and two per exchange) and auxiliary writes (each block copied out for its shuffle)'
  average: 'the same comparisons on every input of n keys; at n = 2^k Batcher''s (k² − k + 4)·2^(k−2) − 1 comparisons, n·k(k − 1) auxiliary writes, and as many array writes plus two per exchange'
claims:
  - id: shuffles-are-auxiliary-traffic
    statement: >-
      On Random permutation at 256 keys the shuffles cost n·k(k − 1) = 14,336 auxiliary writes for k = 8, more than three times the 3,839 comparisons of Batcher's merge: every unshuffle and shuffle copies its block through the auxiliary array.
    readout: Auxiliary writes
    expect: { value: 14336 }
    setup:
      params: { shape: random, n: 256 }
---

Batcher's merge expressed as perfect shuffles and compare-exchanges, as a parallel machine would run it.

To merge a block whose two halves are sorted, unshuffle it (the keys at even positions to the first half, those at odd positions to the second), merge each half the same way, shuffle the halves back together, and compare-exchange the neighbours (1, 2), (3, 4) and so on. That is Batcher's odd-even merge; a mergesort built on it sorts.

A perfect shuffle is the wiring of a parallel machine: every key moves at once, and every compare-exchange of a step could run on its own processor. Here the shuffles are carried out through the auxiliary array, so they show up as auxiliary writes, and which pairs are compared never depends on the keys.

The network is defined for a power-of-two size, so n keys are padded virtually up to the next power of two with keys larger than every real one. No pad is stored: the array holds the real keys in the order of their positions in the padded network, a shuffle rewrites that order, and a compare-exchange with a pad is decided without a comparison because the pad is always the larger key. The sorted result is exactly the one the padded network produces.
