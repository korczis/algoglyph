---
id: ford-johnson
title: Merge insertion (Ford–Johnson)
taxonomy: sorting/hybrid
status: live
engine: array
labs:
  - sorting
sources:
  - id: ford-1959
    ref: the original tournament problem
  - id: knuth-taocp-3
    ref: "5.3.1 Minimum-comparison sorting"
  - id: manacher-1979
    ref: proof that it is not optimal in general
  - id: edelkamp-2014
    ref: use as a base case inside QuickMergesort
tags:
  - sorting
  - hybrid
  - minimum comparisons
  - binary insertion
complexity: n log n in every case; extra space n
related:
  - binary-insertion-sort
  - insertion-sort
  - mergesort-top-down
  - quickxsort
  - tournament-sort
  - weak-heapsort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [binary-insertion-sort]
  objectives:
  - 'Run Random permutation at 512 keys: 3,892 comparisons, under Ford and Johnson''s worst case Σ⌈lg(3k/4)⌉ = 3,931 and 16 above the information-theoretic ⌈lg 512!⌉ = 3,876.'
  - 'Read the Phase readout: two phases for each of the ⌊lg n⌋ levels of recursion, pairing and then inserting, and one for writing the main chain back.'
  - 'Read the Array writes and Auxiliary writes: exactly n of each, since the kernel sorts positions and writes the main chain back once.'
  misconceptions:
  - 'Merge insertion always meets the information-theoretic bound ⌈lg n!⌉; it does for every n up to 11, but at 12 keys its worst case Σ⌈lg(3k/4)⌉ is 30 against 29, and at 512 keys 3,931 against 3,876.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons (the pairings and the binary insertions), array writes (the main chain written back) and auxiliary writes (the main chain drawn once)'
  average: 'exactly n array writes and n auxiliary writes from 2 keys on, and 2⌊lg n⌋ + 1 phases'
  worst: 'at most Σ_{k=1}^{n} ⌈lg(3k/4)⌉ comparisons on every input; some permutation of every size up to 9 needs exactly that many, which there equals ⌈lg n!⌉'
claims:
  - id: within-the-tournament-bound
    statement: >-
      On Random permutation at 512 keys merge insertion makes no more than Ford and Johnson's worst case of Σ⌈lg(3k/4)⌉ = 3,931 comparisons; it makes 3,892, 16 above the information-theoretic ⌈lg 512!⌉ = 3,876.
    readout: Comparisons
    expect: { below: 3932 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Pair the keys and compare within each pair, sort the larger keys recursively into a main chain, then binary-insert the smaller partners in an order chosen so that every search runs over 2^k − 1 keys and wastes no comparison.

Ford and Johnson posed it as a tournament problem: rank n players by strength with as few matches as possible. The goal is the fewest comparisons, not speed on a computer. Each smaller key b is known to lie below its partner a, so it is searched for only among the keys before a, and the groups of insertions follow the Jacobsthal numbers, each group taken from its end.

The worst-case count stays very close to the information-theoretic bound ⌈lg n!⌉: on four keys it uses exactly the five comparisons the bound demands, and for small n it is optimal. Manacher showed in 1979 that it is not optimal in general.

Start with Random permutation at n = 32 and watch the comparison counter, which is the reason the method exists. The write counter stays at n: the kernel sorts positions and writes the result back once, whereas inserting into an array would shift keys, and keeping track of partners costs work, which is the method's weakness on a computer. That is why it lives on as a base case inside comparison-saving hybrids such as QuickXsort, and as the method of choice when one comparison is a human judgement or an experiment. It is not stable and it does not work in place.
