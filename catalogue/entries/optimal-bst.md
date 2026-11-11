---
id: optimal-bst
title: Optimal binary search tree
taxonomy: foundations/dynamic-programming
status: live
engine: grid
labs:
  - dynamic-programming
sources:
  - id: sedgewick-aic-1990
    ref: Advanced Topics
tags:
  - dynamic programming
  - search trees
complexity: "Θ(n³) time, Θ(n²) space (Knuth's monotone-root bound gives Θ(n²))"
related:
  - matrix-chain
---

The search tree with least expected cost for known access frequencies, built from subtrees.

Keys are known in order with access frequencies; the cost of a tree is the sum of each key's frequency times its number of comparisons (depth plus one). Cell (i, j) is the cheapest tree on keys i to j-1, and the diagonal holds the empty ranges.

Choosing a root pushes every other key in the range one level down, so a cell is the range's total frequency plus the cheapest left and right subtrees, both shorter ranges already in the table. Like the matrix chain, it fills diagonal by diagonal and tries every root.

The traceback rebuilds the tree from the remembered roots and outlines each range it descends into. Frequent keys end up near the root, but not always at it: the balance of the two sides counts too.
