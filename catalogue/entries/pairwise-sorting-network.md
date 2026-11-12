---
id: pairwise-sorting-network
title: Pairwise sorting network
taxonomy: sorting/networks
status: live
engine: array
labs:
  - sorting
sources:
  - id: parberry-1992
    ref: the original construction and its size and depth
  - id: knuth-taocp-3
    ref: "5.3.4 Networks for sorting"
  - id: ajtai-1983
    ref: the asymptotically shallower network
tags:
  - sorting
  - sorting network
  - oblivious
  - in-place
  - parallel
  - zero-one principle
complexity: n log² n in every case; extra space 1
related:
  - batcher-merge-exchange
  - bitonic-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [batcher-merge-exchange]
  objectives:
  - 'Run Random permutation at 512 keys: 9,727 comparators in 45 rounds, the size and depth of Batcher''s odd-even merge network.'
  - 'Compare with Batcher''s merge exchange in the lab at any n: the comparator counts agree, also at sizes that are not powers of two.'
  - 'Follow the Phase readout: first the pairs at distances 1, 2, 4, …, then the repairs at shrinking distances.'
  misconceptions:
  - 'Sorting the pairs first must cost extra comparators; Parberry''s order needs exactly as many as Batcher''s merge exchange at every n up to 1,024.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
bounds:
  model: 'comparators (one comparison each, and an exchange of two writes when its keys are out of order) and rounds (one layer of disjoint comparators); no auxiliary write'
  average: 'the same network on every input: ⌈lg n⌉(⌈lg n⌉ + 1)/2 rounds and as many comparators as Batcher''s merge exchange, (k² − k + 4)·2^(k−2) − 1 at n = 2^k, 9,727 in 45 rounds at 512 keys; no write on Already sorted'
claims:
  - id: batcher-depth
    statement: >-
      On Random permutation at 512 keys the pairwise network takes k(k + 1)/2 = 45 rounds for k = 9, the depth of Batcher's odd-even merge network, with the same 9,727 comparators.
    readout: Rounds
    expect: { value: 45 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Parberry's network turns Batcher's order around: first sort neighbouring pairs, then pairs of pairs and so on, and only then repair the result with comparators at shrinking distances.

After the pairs are sorted, the smaller and the larger members of the pairs form two sequences that can be sorted independently; once both are sorted, the array is nearly in order and a final phase of comparators between different pairs removes what is left. Parberry derived the construction from the zero-one principle and proved that it has exactly the size and the depth of Batcher's odd-even merge network.

The plate runs each parallel round as a sequence of disjoint comparators and counts the total work, which is on the order of n log² n compare-exchanges for every input; the depth, the parallel time, is on the order of log² n. Start with Random permutation at n = 64 and watch the long-distance repairs of the second phase; then compare the counts in the lab with Batcher's merge exchange and bitonic sort.

It saves no comparators over Batcher's network, so its value is the result itself: a quite different route, from sorting pairs and putting them into lexicographic order, reaches the same optimum. The network of Ajtai, Komlós and Szemerédi has asymptotically smaller depth, on the order of log n. Like every comparator network it is in place and not stable.
