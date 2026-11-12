---
id: bst-delete-join
title: Deletion and join in a binary search tree
taxonomy: searching/binary-trees
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - binary search tree
  - deletion
complexity: proportional to the height of the tree per operation
related:
  - bst-search-insert
  - randomized-bst
---

Delete a key by joining its two subtrees, and see what repeated deletion does to the shape.

Deleting a node with two subtrees needs a new root for them. This kernel joins them: the smallest key of the right subtree is rotated up to the top of that subtree, where it has no left child, and the left subtree is hung there. The rotations are counted and drawn.

The plate inserts the keys, runs the searches, then deletes half of the keys one at a time. Because the replacement always comes from the right, the deletion is asymmetric, and long mixes of random insertions and such deletions are known to leave trees less balanced than random insertion alone.
