---
id: cartesian-tree-sort
title: Cartesian tree sort
taxonomy: sorting/trees
status: live
engine: array
labs:
  - sorting
sources:
  - id: vuillemin-1980
    ref: Cartesian trees introduced
  - id: levcopoulos-1989
    ref: the adaptive sort built on them
  - id: cormen-2022
    ref: "Chapter 6: Heapsort (binary heaps)"
tags:
  - sorting
  - search tree
  - adaptive
  - heap
complexity: n best, n log n average and worst; extra space n
related:
  - heapsort
  - mergesort-natural
  - smoothsort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [binary-heap, heapsort]
  objectives:
  - 'Run Already sorted or Reversed at 64 keys: 63 comparisons, n − 1, and 127 auxiliary writes, since the tree is one path.'
  - 'Run Organ pipe at 64 keys: 125 comparisons, 2n − 3, for an input that is neither ascending nor descending.'
  - 'Read the Comparisons readout when the Phase readout turns to the output: the build has made between n − 1 and 2n − 3 comparisons on every input; the rest belongs to the candidate heap.'
  misconceptions:
  - 'A sort that outputs through a binary heap pays n log n on every input; on Already sorted, Reversed and keys all equal this one makes n − 1 comparisons.'
algorithm:
  properties:
    stable: false
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons (the build''s stack, then the candidate heap), array writes (one per key output) and auxiliary writes (the copied nodes and every change of the drawn candidate heap)'
  best: 'n − 1 comparisons and 2n − 1 auxiliary writes on Already sorted, Reversed and keys all equal; 2n − 3 comparisons on Organ pipe'
  average: 'the build between n − 1 and 2n − 3 comparisons on every input of n ≥ 2 keys; n array writes'
  worst: 'O(n log n); O(n log(Osc/n)) for an input of oscillation Osc (Levcopoulos and Petersson)'
claims:
  - id: organ-pipe-is-linear
    statement: >-
      On Organ pipe at 64 keys Cartesian tree sort makes 125 comparisons, 2n − 3: linear, although the input first rises and then falls.
    readout: Comparisons
    expect: { value: 125 }
    setup:
      params: { shape: organ-pipe, n: 64 }
---

Build the Cartesian tree of the input, whose root is the smallest key with the trees of the left and right parts below it, then output keys with a small binary heap that holds only the roots of the subtrees not yet output.

The Cartesian tree, introduced by Vuillemin, is a heap by key and a search tree by position at the same time: an in-order walk returns the input order. It is built in linear time with one left-to-right pass and a stack, because each key is pushed and popped at most once. The smallest key still to come is always the root of one of the pending subtrees, so the heap of candidates is only as large as the input is disordered.

Levcopoulos and Petersson turned this into heapsort adapted for presorted files. On ascending input the tree is a single path, the candidate heap never holds more than one key and the whole sort is linear; in the worst case each removal costs a logarithm of a heap that never exceeds n, which gives n log n. Start with Nearly sorted at n = 128, then Random permutation at the same size: the comparison counter shows how the cost follows the disorder.

The price is memory: child links for every key and a candidate heap that can grow towards n, so it does not sort in place, and the heap does not keep equal keys in input order, so it is not stable. On random data it is slower than heapsort; on data that arrives in locally monotone stretches it shows why adaptivity pays, the same lesson smoothsort teaches without extra memory.
