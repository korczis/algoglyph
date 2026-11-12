---
id: aks-sorting-network
title: AKS sorting network
taxonomy: sorting/networks
status: live
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
complexity: n log n comparators in log n depth (AKS); the plate's simplification n log² n comparators in log² n depth; extra space 1
related:
  - batcher-merge-exchange
  - bitonic-sort
  - pairwise-sorting-network
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [batcher-merge-exchange]
  objectives:
  - 'Read the Rounds readout at 512 keys: 72, the 27 rounds of nine halver levels with three matchings each, then the 45 rounds of Batcher''s merge exchange, which the kernel runs as its cleanup.'
  - 'Count the comparators at 512 keys: 3 × 256 × 9 = 6,912 in the halvers and Batcher''s 9,727 in the cleanup, 16,639 on every input.'
  - 'Explain why the cleanup alone would sort: its comparators are exactly Batcher''s merge exchange network, so the halvers only prepare the order the cleanup then guarantees.'
  misconceptions:
  - 'The plate''s AKS network has the logarithmic depth of the theorem; its halvers are not certified, so a Batcher cleanup follows, and its depth is 3⌈lg n⌉ + ⌈lg n⌉(⌈lg n⌉ + 1)/2 rounds, 72 at 512 keys against the 45 of Batcher''s network alone.'
algorithm:
  properties:
    stable: false
    in_place: true
bounds:
  model: 'comparators (one comparison each, and an exchange of two writes when its keys are out of order) and rounds (one matching of the halvers or one cleanup layer, its comparators disjoint); no auxiliary write'
  average: 'the same network on every input of n keys: 3⌈lg n⌉ + ⌈lg n⌉(⌈lg n⌉ + 1)/2 rounds, and three times the halver tree''s comparators plus those of Batcher''s merge exchange, (3n/2) lg n + (k² − k + 4)·2^(k−2) − 1 at n = 2^k, 16,639 in 72 rounds at 512 keys; no write on Already sorted'
claims:
  - id: simplified-depth
    statement: >-
      On Random permutation at 512 keys the plate's AKS network takes 72 rounds: nine halver levels of three matchings each, 27 rounds, then the 45 rounds of Batcher's merge exchange that the uncertified halvers need as a cleanup.
    readout: Rounds
    expect: { value: 72 }
    setup:
      params: { shape: random, n: 512 }
---

The network of Ajtai, Komlós and Szemerédi: depth on the order of log n and on the order of n log n comparators, both asymptotically optimal, built from approximate halvers applied over a tree of intervals.

The building block is an ε-halver, a constant-depth network that splits its input into two halves so that at most a small fraction ε of keys lands on the wrong side; comparators placed along the edges of an expander graph make one. AKS applies such halvers to a hierarchy of intervals and keeps sending misplaced keys back towards the right side. Paterson later restated the construction so that its constant could be computed, but the constant stayed far too large for any practical input.

The plate is explicitly a simplification and says so: a faithful AKS network has no instance of useful size. It keeps the visible idea, a tree of approximate halvers built from fixed pseudo-random matchings between the halves of every segment, and then lets Batcher's merge exchange finish the job, because those halvers are not certified. Its depth is therefore on the order of log² n, not log n. Start with Random permutation at n = 64 and watch how much order the halver levels create before the cleanup begins.

In practice it is never used to sort data. Its role is the proof that a fixed circuit of logarithmic depth can sort; as a data-oblivious sort with n log n comparisons it also appears in designs that need exactly that, such as oblivious RAM, where the access pattern must not depend on the keys. Real fixed networks remain Batcher's, with depth on the order of log² n but small constants.
