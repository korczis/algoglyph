---
id: avl-tree-sort
title: AVL tree sort
taxonomy: sorting/trees
status: live
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "6.2.3 Balanced trees"
  - id: cormen-2022
    ref: "13.2 Rotations"
tags:
  - sorting
  - search tree
  - balanced tree
  - online
complexity: n log n in every case; extra space n
related:
  - avl-tree
  - heapsort
  - tree-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [tree-sort, avl-tree]
  objectives:
  - 'Run Already sorted at 64 keys: 321 comparisons, where plain tree sort needs 2,016; at 512 keys 4,097 against 130,816.'
  - 'Count the comparisons of Already sorted as Σ (⌊lg m⌋ + 1) over m = 1..n − 1: each new key walks the right spine of a tree the rotations keep balanced.'
  - 'Read Array writes and Auxiliary writes: n each on every input; the rotations relink nodes and write no key.'
  misconceptions:
  - 'Already sorted is the worst input, as it is for plain tree sort; at eight keys it costs 17 comparisons and the worst permutation 18, the AVL height bound.'
algorithm:
  paradigm: incremental
  properties:
    in_place: false
    comparison_based: true
  invariants:
    - The heights of the two subtrees of every node differ by at most one after each insertion.
bounds:
  model: 'comparisons (one per node passed on the way down; rotations compare nothing), array writes (the in-order walk) and auxiliary writes (one node per key)'
  best: 'Σ (⌊lg m⌋ + 1) comparisons over m = 1..n − 1 on Already sorted, Reversed and keys all equal'
  worst: 'at most Σ H(m) comparisons over m = 1..n − 1, H(m) the greatest height of an AVL tree of m nodes (fewest nodes N(h) = N(h − 1) + N(h − 2) + 1), reached by some permutation of every size up to eight; H(m) < 1.4405 lg(m + 2), so O(n log n) (Adelson-Velsky and Landis; Knuth)'
  space: 'n tree nodes: n auxiliary writes and n array writes on every input'
claims:
  - id: sorted-input-stays-logarithmic
    statement: >-
      On Already sorted at 64 keys AVL tree sort makes 321 comparisons, Σ (⌊lg m⌋ + 1) for m = 1..63, where the unbalanced tree needs 2,016.
    readout: Comparisons
    expect: { value: 321 }
    setup:
      params: { shape: sorted, n: 64 }
---

Tree sort into an AVL tree: after every insertion the balance factors are updated on the path back to the root, and a single or double rotation restores the rule that the two subtrees of any node differ in height by at most one; an in-order walk then reads the keys out sorted.

A rotation changes the shape of the tree but never its in-order sequence, which is why the tree can be rebalanced at every step without disturbing the order the result is read from. The AVL tree, due to Adelson-Velsky and Landis in 1962, was the first binary search tree with a logarithmic bound on its height.

That bound makes every insertion O(log n), rebalancing included, so the sort is n log n in the best, average and worst case. Already sorted at n = 64 is the input that shows the difference: plain tree sort turns it into a chain of length n and quadratic comparisons, the AVL tree keeps it logarithmic. Sorted input saves little, so the method is not adaptive.

On its own it is rarely the best choice: heapsort and mergesort give the same guarantee with less memory and better access to it. It earns its place when the tree is wanted anyway, for insertions, deletions and searches, and the sorted listing is one operation among them; equal keys sent always to the right keep their arrival order.
