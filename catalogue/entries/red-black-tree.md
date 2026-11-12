---
id: red-black-tree
title: Red-black tree
taxonomy: searching/balanced-trees
status: live
engine: tree
labs:
  - search-trees
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - balanced trees
  - red-black
  - rotations
complexity: height at most 2 lg n; lg n per insert and search
related:
  - two-three-four-tree
  - avl-tree
---

A binary tree that encodes 2-3-4 nodes with red links and stays within 2 lg n deep.

A red node is glued to its parent: together they form a 3-node or, with a red sibling, a 4-node of a 2-3-4 tree. This kernel is the left-leaning variant: on the way down a 4-node is split by flipping three colours, and on the way up a right-leaning red link is rotated left and two reds in a row are rotated right. Red links are drawn thick.

Every path from the root to an empty link crosses the same number of black nodes and no two red nodes touch, so no path is more than twice as long as another. The test harness checks both properties on every input, and the height bound on ascending, descending and random keys.
