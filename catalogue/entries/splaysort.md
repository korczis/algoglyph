---
id: splaysort
title: Splaysort
taxonomy: sorting/trees
status: planned
engine: array
labs:
  - sorting
sources:
  - id: moffat-1996
    ref: splaysort described and measured
  - id: sleator-1985
    ref: splay trees and their amortised bound
  - id: estivill-castro-1992
    ref: measures of presortedness
tags:
  - sorting
  - search tree
  - self-adjusting
  - adaptive
  - online
complexity: n best, n log n average and worst; extra space n
related:
  - avl-tree-sort
  - insertion-sort
  - splay-tree
  - tree-sort
---

Tree sort into a splay tree: every inserted key is rotated to the root by zig, zig-zig and zig-zag steps, and an in-order walk reads the keys out sorted at the end.

A splay tree keeps no balance information at all. Splaying a node to the root also shortens the paths to the other nodes that lay on its access path, and Sleator and Tarjan proved that any sequence of m operations on a tree of at most n nodes costs O(m log n) amortised; for splaysort that means O(n log n) in the worst case, even though a single insertion can be expensive.

What splaysort gains is adaptivity: recently inserted keys sit near the root, so input that is close to sorted, or that revisits a few neighbourhoods, is cheap. Estivill-Castro and Wood's survey frames this through measures of disorder such as the number of inversions or runs, and Moffat, Eddy and Petersson presented splaysort in 1996 as a fast, versatile, practical adaptive sort. Compare Nearly sorted with Random permutation at n = 128 and read the comparison counts.

The price is a pointer-based tree with n nodes, so it does not work in place, and rotations preserve the in-order sequence, so stability depends only on where equal keys are sent. Unlike AVL tree sort it stores no balance factors, and its n log n bound is amortised rather than per operation.
