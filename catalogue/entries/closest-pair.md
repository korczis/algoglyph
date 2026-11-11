---
id: closest-pair
title: Closest pair by divide and conquer
taxonomy: geometry/proximity
status: live
engine: geometry
sources:
  - id: sedgewick-aic-1990
    ref: Geometric Algorithms
tags:
  - closest pair
  - divide and conquer
complexity: "O(n log n)"
related:
  - voronoi-diagram
  - kd-tree
---

Split at the median, solve each half, and check only a strip around the cut.

Points are sorted by x once. Each half is solved recursively and handed back sorted by y, by a merge, as in mergesort. Only points closer to the dividing line than the best distance so far can improve it; that strip is shaded, and in y order each strip point is compared only with those above it that are still within the best distance.

A packing argument bounds how many points can sit in the strip within that distance of each other, so the combine step is linear. The readout sets the distance computations made against the n(n − 1)/2 a brute-force search needs.
