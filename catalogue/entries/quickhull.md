---
id: quickhull
title: Quickhull
taxonomy: geometry/hulls
status: live
engine: geometry
labs:
  - hulls
sources:
  - id: sedgewick-aic-1990
    ref: Geometric Algorithms
tags:
  - convex hull
  - divide and conquer
complexity: "O(n log n) expected, O(n²) worst case"
related:
  - gift-wrapping
  - graham-scan
---

The farthest point from a dividing line splits the problem in two, like quicksort.

The leftmost and rightmost points split the set by the line through them. On each side the point farthest from the line (the largest cross product) is a corner; the points inside the triangle it forms are dropped, and the two groups outside its new edges are solved the same way.

As in #/p/quicksort, the split is only as good as the data. In a disk most points fall inside the first triangles and are gone after a few levels. On a circle nothing is ever discarded, yet the farthest point sits near the middle of each arc, so the splits stay balanced and the measured growth stays close to n log n; the quadratic case needs splits that peel off one corner at a time.
