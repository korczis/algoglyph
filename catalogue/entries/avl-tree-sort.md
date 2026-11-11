---
id: avl-tree-sort
title: AVL tree sort
taxonomy: sorting/trees
status: planned
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
---

Tree sort into an AVL tree: after every insertion the balance factors are updated on the path back to the root, and a single or double rotation restores the rule that the two subtrees of any node differ in height by at most one; an in-order walk then reads the keys out sorted.

A rotation changes the shape of the tree but never its in-order sequence, which is why the tree can be rebalanced at every step without disturbing the order the result is read from. The AVL tree, due to Adelson-Velsky and Landis in 1962, was the first binary search tree with a logarithmic bound on its height.

That bound makes every insertion O(log n), rebalancing included, so the sort is n log n in the best, average and worst case. Already sorted at n = 64 is the input that shows the difference: plain tree sort turns it into a chain of length n and quadratic comparisons, the AVL tree keeps it logarithmic. Sorted input saves little, so the method is not adaptive.

On its own it is rarely the best choice: heapsort and mergesort give the same guarantee with less memory and better access to it. It earns its place when the tree is wanted anyway, for insertions, deletions and searches, and the sorted listing is one operation among them; equal keys sent always to the right keep their arrival order.
