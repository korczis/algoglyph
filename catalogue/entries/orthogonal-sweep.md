---
id: orthogonal-sweep
title: Sweep line for orthogonal segments
taxonomy: geometry/intersection
status: live
engine: geometry
sources:
  - id: sedgewick-aic-1990
    ref: Geometric Algorithms
tags:
  - sweep line
  - intersection
  - bst
complexity: "O(n log n + k) expected for k intersections, with an unbalanced search tree on random heights"
related:
  - general-sweep
  - ccw-intersection
---

A vertical line sweeps across, holding the horizontal segments it crosses in a search tree.

A vertical line moves from left to right through the segment ends, sorted once by x. A horizontal segment enters a binary search tree keyed by its height at its left end and leaves at its right end (Hibbard deletion); the highlighted segments are the ones in the tree. Each vertical segment is a range query on the tree, which reports exactly the horizontal segments whose height it spans.

The input has real coordinates, so no two ends share an x and no two horizontals share a height; the tree is not balanced, which on random heights still gives logarithmic depth on average.
