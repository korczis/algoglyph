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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Build the search tree of least expected cost for known access frequencies.
  - See why a root's cost is the range's total frequency plus its two subtrees.
algorithm:
  paradigm: dynamic-programming
bounds:
  model: cell reads
  worst: Θ(n³) trying every root
  space: Θ(n²) cells
---

The search tree with least expected cost for known access frequencies, built from subtrees.

Keys 0 to n-1 are known in order with access frequencies. The weighted cost of a tree is the sum of each key's frequency times its number of comparisons (depth plus one); divided by the total frequency it is the expected number of comparisons per search, and the readout prints both. Cell (i, j) is the cheapest tree on keys i to j-1, and the diagonal holds the empty ranges.

Choosing a root pushes every other key in the range one level down, so a cell is the range's total frequency plus the cheapest left and right subtrees, both shorter ranges already in the table. Like the matrix chain, it fills diagonal by diagonal and tries every root.

The traceback rebuilds the tree from the remembered roots and outlines each range it descends into. Frequent keys end up near the root, but not always at it: the balance of the two sides counts too.
