---
id: tournament-sort
title: Tournament sort
taxonomy: sorting/priority-queues
status: live
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "5.2.3 Sorting by selection (tree selection)"
  - id: cormen-2022
    ref: "Chapter 6: Heapsort"
tags:
  - sorting
  - heap
  - priority queue
  - tree selection
complexity: n log n in every case; extra space n
related:
  - heapsort
  - replacement-selection
  - selection-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [selection-sort]
  objectives:
  - 'Count the first tournament: n − 1 comparisons, then at most ⌈lg n⌉ for each replay.'
  - 'Read the Array writes: exactly n on every input, every key written once into its final place.'
  - 'Compare Already sorted with Random permutation at 512 keys: 2,304 = ½ n lg n comparisons against 3,988, since a match with no opponent left is not played.'
  misconceptions:
  - 'A tournament costs the same on every input; at 512 keys Already sorted and Reversed cost 2,304 comparisons and Random permutation 3,988.'
algorithm:
  paradigm: incremental
  properties:
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons and array writes (each key copied once into its final place)'
  average: 'exactly n array writes on every input; Reversed Σ_{k<n} ν(k) comparisons (ν(k) the 1-bits of k), and Already sorted and keys all equal ½ n lg n when n is a power of two'
  worst: 'n − 1 comparisons for the first tournament, then at most ⌈lg n⌉ for each replay'
claims:
  - id: sorted-half-n-lg-n
    statement: >-
      On Already sorted at 512 keys tournament sort makes ½ n lg n = 2,304 comparisons, against 3,988 on Random permutation.
    readout: Comparisons
    expect: { value: 2304 }
    setup:
      params: { shape: sorted, n: 512 }
---

A knockout tournament: the keys are players at the leaves of a binary tree, every inner node holds the winner (the smaller key) of its two children, and the champion at the root is the minimum; output it, replace its leaf with infinity, and replay only the matches on its path.

That replay is the whole point. Straight selection searches for every minimum from scratch with a linear scan; the tournament remembers the results of earlier matches, so after the first tournament of n − 1 comparisons each further minimum costs at most as many comparisons as the tree has levels. In total that is of order n log n on every input, but the count depends on the order, because a match with no opponent left is not played: at 512 keys Already sorted and Reversed cost ½ n lg n = 2,304 comparisons, Random permutation 3,988.

The winner tree needs room for its inner nodes and the output usually goes to a separate array, so the extra space is linear; heapsort reaches the same n log n inside the array itself, and in memory it wins. Start with Random permutation at n = 64 and set it against selection sort in the lab: the gap between their comparison counts is the value of remembered matches.

Whether equal keys keep their input order depends on the tie rule: if a tie always goes to the key from the left, the sort is stable, otherwise it is not. Tournament trees matter most outside in-memory sorting, as the selection step of multiway merging and of replacement selection in external sorting.
