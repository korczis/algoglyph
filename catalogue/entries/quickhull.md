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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Find a hull corner as the point farthest from a dividing line, the one with the largest cross product.
    - Drop the points inside the triangle that corner forms and solve the two groups outside its new edges the same way.
    - Relate the cost to the splits, as in quicksort, and see why a circle, where nothing is discarded, still splits evenly while the quadratic case peels off one corner at a time.
  prerequisites:
    - quicksort
algorithm:
  paradigm: divide-and-conquer
bounds:
  model: orientation tests
  average: O(n log n) expected
  worst: O(n²)
claims:
  - id: nothing-discarded-on-a-circle
    statement: >-
      On 160 points of a circle nothing is ever discarded: every point is a corner, so the hull
      has exactly n = 160 vertices.
    readout: Hull vertices
    expect: { value: 160 }
    setup:
      params: { shape: circle }
---

The farthest point from a dividing line splits the problem in two, like quicksort.

The leftmost and rightmost points split the set by the line through them. On each side the point farthest from the line (the largest cross product) is a corner; the points inside the triangle it forms are dropped, and the two groups outside its new edges are solved the same way.

As in #/p/quicksort, the split is only as good as the data. In a disk most points fall inside the first triangles and are gone after a few levels. On a circle nothing is ever discarded, yet the farthest point sits near the middle of each arc, so the splits stay balanced and the measured growth stays close to n log n; the quadratic case needs splits that peel off one corner at a time.
