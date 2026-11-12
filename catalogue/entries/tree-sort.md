---
id: tree-sort
title: Tree sort
taxonomy: sorting/trees
status: live
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "6.2.2 Binary tree searching"
  - id: cormen-2022
    ref: "Chapter 12: Binary search trees"
tags:
  - sorting
  - search tree
  - insertion
  - online
complexity: n log n best, n log n average, n² worst; extra space n
related:
  - bst-search-insert
  - cartesian-tree-sort
  - insertion-sort
  - quicksort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites: [bst-search-insert, tree-traversal]
  objectives:
  - 'Run Already sorted at 64 keys: 2,016 comparisons, n(n − 1)/2, since every key descends the whole chain the keys before it built.'
  - 'Read Array writes and Auxiliary writes on any input: n each, one node per key inserted and one write per key of the in-order walk.'
  - 'Run Random permutation at 512 keys, then Already sorted: 5,173 comparisons against 130,816.'
  misconceptions:
  - 'Input already in order is the easy case; for an unbalanced search tree it is the worst: Already sorted, Reversed and keys all equal each cost n(n − 1)/2 comparisons, the most any input can.'
algorithm:
  paradigm: incremental
  properties:
    in_place: false
    comparison_based: true
  postconditions:
    - The array is ascending and a permutation of the input.
bounds:
  model: 'comparisons (one per node passed on the way down, so the internal path length of the tree built), array writes (the in-order walk) and auxiliary writes (one node per key)'
  best: 'never fewer than Σ ⌊lg k⌋ comparisons over k = 1..n, the least internal path length of a binary tree of n nodes, which some permutation reaches at every n up to eight'
  average: 'n log n expected for keys in random order (Knuth); on Random permutation at 512 keys the plate counts 5,173'
  worst: 'n(n − 1)/2 comparisons, the most of any input, on Already sorted, Reversed and keys all equal'
  space: 'n tree nodes: n auxiliary writes and n array writes on every input'
claims:
  - id: sorted-input-builds-a-chain
    statement: >-
      On Already sorted at 64 keys tree sort makes 2,016 comparisons, n(n − 1)/2: every key becomes the right child of the one before and descends the whole chain.
    readout: Comparisons
    expect: { value: 2016 }
    setup:
      params: { shape: sorted, n: 64 }
---

Insert the keys one by one into a binary search tree, each descending from the root to an empty leaf, then read them back by an in-order walk: left subtree, node, right subtree.

It is insertion sort with a better place to insert into: finding a key's position takes one comparison per level of the tree and nothing has to be shifted. The cost of the whole sort is the total depth of the nodes, and for keys arriving in random order the expected height of the tree is logarithmic, so the expected cost is n log n.

The order of arrival is everything. Run it on Random permutation at n = 64, then on Already sorted: every key becomes the right child of the one before, the tree degenerates into a list, and the comparisons climb to n(n − 1)/2. Reversed does the same on the left.

The deeper connection is with quicksort: the root plays the part of the first pivot, and a random binary search tree is the recursion tree of quicksort that partitions around the first key. Sending equal keys always to the right keeps them in arrival order in the in-order walk, so stability depends on that rule. When an n log n guarantee is needed, the tree has to be balanced, as in AVL tree sort.
