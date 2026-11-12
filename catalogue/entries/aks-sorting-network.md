---
id: aks-sorting-network
title: AKS sorting network
taxonomy: sorting/networks
status: planned
engine: array
labs:
  - sorting
sources:
  - id: ajtai-1983
    ref: the original result
  - id: paterson-1990
    ref: the simplified construction
  - id: sanders-2019
    ref: why it stays impractical
  - id: knuth-taocp-3
    ref: "5.3.4 Networks for sorting"
  - id: goodrich-2014
    ref: data-oblivious sorting in oblivious RAM
tags:
  - sorting
  - sorting network
  - oblivious
  - in-place
  - parallel
  - expander graphs
complexity: n log n in every case; extra space 1
related:
  - batcher-merge-exchange
  - bitonic-sort
  - pairwise-sorting-network
---

The network of Ajtai, Komlós and Szemerédi: depth on the order of log n and on the order of n log n comparators, both asymptotically optimal, built from approximate halvers applied over a tree of intervals.

The building block is an ε-halver, a constant-depth network that splits its input into two halves so that at most a small fraction ε of keys lands on the wrong side; comparators placed along the edges of an expander graph make one. AKS applies such halvers to a hierarchy of intervals and keeps sending misplaced keys back towards the right side. Paterson later restated the construction so that its constant could be computed, but the constant stayed far too large for any practical input.

The plate is explicitly a simplification and says so: a faithful AKS network has no instance of useful size. It keeps the visible idea, a tree of approximate halvers built from fixed pseudo-random matchings between the halves of every segment, and then lets Batcher's merge exchange finish the job, because those halvers are not certified. Its depth is therefore on the order of log² n, not log n. Start with Random permutation at n = 64 and watch how much order the halver levels create before the cleanup begins.

In practice it is never used to sort data. Its role is the proof that a fixed circuit of logarithmic depth can sort; as a data-oblivious sort with n log n comparisons it also appears in designs that need exactly that, such as oblivious RAM, where the access pattern must not depend on the keys. Real fixed networks remain Batcher's, with depth on the order of log² n but small constants.
