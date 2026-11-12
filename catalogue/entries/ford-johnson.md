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
---

Pair the keys and compare within each pair, sort the larger keys recursively into a main chain, then binary-insert the smaller partners in an order chosen so that every search runs over 2^k − 1 keys and wastes no comparison.

Ford and Johnson posed it as a tournament problem: rank n players by strength with as few matches as possible. The goal is the fewest comparisons, not speed on a computer. Each smaller key b is known to lie below its partner a, so it is searched for only among the keys before a, and the groups of insertions follow the Jacobsthal numbers, each group taken from its end.

The worst-case count stays very close to the information-theoretic bound ⌈lg n!⌉: on four keys it uses exactly the five comparisons the bound demands, and for small n it is optimal. Manacher showed in 1979 that it is not optimal in general.

Start with Random permutation at n = 32 and watch the comparison counter, which is the reason the method exists, against the write counter, which is its weakness: inserting into an array shifts keys, and keeping track of partners costs work. That is why it lives on as a base case inside comparison-saving hybrids such as QuickXsort, and as the method of choice when one comparison is a human judgement or an experiment. It is not stable and it does not work in place.
