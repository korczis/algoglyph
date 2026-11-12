---
id: bst-root-insertion
title: Insertion at the root
taxonomy: searching/binary-trees
status: live
engine: tree
labs:
  - search-trees
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - binary search tree
  - rotations
complexity: the comparisons of a plain insertion plus one rotation per level climbed
related:
  - randomized-bst
  - bst-rotations
---

Insert at the bottom, then rotate the new key up to the root.

The new key is inserted at the bottom, then rotated over each of its ancestors on the way back up, right when it came from the left and left when it came from the right, until it is the root. Keys inserted recently are found after a few comparisons.

The tree that results is exactly the plain search tree of the same keys inserted in reverse order, so on random input its shape is just as random, and ascending input still builds a path, now leaning the other way.
