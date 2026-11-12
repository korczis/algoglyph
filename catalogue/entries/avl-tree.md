---
id: avl-tree
title: AVL tree
taxonomy: searching/balanced-trees
status: live
engine: tree
labs:
  - search-trees
sources:
  - id: knuth-taocp-3
tags:
  - balanced trees
  - rotations
  - height
complexity: height below 1.44 lg n; lg n per insert and search
related:
  - red-black-tree
  - bst-rotations
---

Keep the heights of every node's subtrees within one, with single and double rotations.

Each node keeps the height of its subtree, printed beside it when the nodes are large enough. After an insertion the heights are recomputed on the way back up; a node whose subtrees differ by two is rotated once when the heavy grandchild is on the outside and twice when it is on the inside, which restores the subtree's old height.

A tree whose subtrees differ in height by at most one has at least a Fibonacci number of nodes for its height, so the height stays below about 1.44 lg n. The test harness checks the balance condition at every node, and the bound on ascending, zig-zag and random input.
