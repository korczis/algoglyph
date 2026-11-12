---
id: splay-tree
title: Splay tree
taxonomy: searching/balanced-trees
status: live
engine: tree
labs:
  - search-trees
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - splay
  - self-adjusting
  - amortised
complexity: amortised lg n per operation
related:
  - bst-root-insertion
  - randomized-bst
---

Every access rotates the key to the root in pairs, which halves the path depth on the way.

A splay moves the accessed key up two levels at a time. When the key, its parent and its grandparent lie on a straight line the grandparent is rotated first (zig-zig); when they zig-zag the parent is rotated first; a final single rotation finishes at the root. An insertion splays the nearest key to the root and splits the tree around the new one.

One operation can be slow, a search down a long path costs a comparison per level, but the zig-zig step roughly halves the depth of every node on that path, and over any sequence of operations the cost is O(lg n) each. Keys accessed recently stay near the root; the tests check that every access leaves the key it found at the root.
