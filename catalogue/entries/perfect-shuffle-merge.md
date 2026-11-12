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
---

Batcher's merge expressed as perfect shuffles and compare-exchanges, as a parallel machine would run it.

To merge a block whose two halves are sorted, unshuffle it (the keys at even positions to the first half, those at odd positions to the second), merge each half the same way, shuffle the halves back together, and compare-exchange the neighbours (1, 2), (3, 4) and so on. That is Batcher's odd-even merge; a mergesort built on it sorts.

A perfect shuffle is the wiring of a parallel machine: every key moves at once, and every compare-exchange of a step could run on its own processor. Here the shuffles are carried out through the auxiliary array, so they show up as auxiliary writes, and which pairs are compared never depends on the keys.

The network is defined for a power-of-two size, so n keys are padded virtually up to the next power of two with keys larger than every real one. No pad is stored: the array holds the real keys in the order of their positions in the padded network, a shuffle rewrites that order, and a compare-exchange with a pad is decided without a comparison because the pad is always the larger key. The sorted result is exactly the one the padded network produces.
