---
id: randomized-bst
title: Randomized binary search tree
taxonomy: searching/balanced-trees
status: live
engine: tree
labs:
  - search-trees
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - randomized
  - balanced trees
  - treap
complexity: about 1.39 lg n expected compares per search, whatever the input order
related:
  - bst-root-insertion
  - bst-delete-join
  - splay-tree
---

Every insertion lands at the root with the right probability, so the tree is random whatever the order.

Each node keeps its subtree size, printed beside it when there is room. At a subtree of size s the new key becomes its root with probability 1/(s+1), by root insertion; otherwise the insertion continues down. The random draws come from the plate's seed, so the same URL rebuilds the same tree.

Because each key is equally likely to be the root of any subtree it lands in, the tree is distributed like a search tree built from a random permutation, even on ascending input. Deletion joins the two subtrees by the same rule, choosing either root in proportion to its size, so the property survives deletions; the plate deletes half the keys after the searches.
