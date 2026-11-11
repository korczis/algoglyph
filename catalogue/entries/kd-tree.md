---
id: kd-tree
title: 2D tree
taxonomy: geometry/range
status: live
engine: geometry
sources:
  - id: sedgewick-aic-1990
    ref: Geometric Algorithms
tags:
  - kd-tree
  - range search
  - nearest neighbour
complexity: "O(log n) expected per insertion and per nearest-neighbour query on random points; a rectangle query visits O(√n + k) nodes"
related:
  - grid-method
  - r-tree
---

Split alternately on x and y: rectangle and nearest-neighbour queries prune whole halves.

Points are inserted in input order. The root splits the field with a vertical line through its point, its children split their halves with horizontal lines, and the levels alternate from there; a key smaller than the node's goes low, anything else high. Each line is drawn across the cell it divides.

The rectangle query descends into a side only when the rectangle reaches it; the shaded cells are the nodes it visited, and the readouts compare that count with n. The nearest-neighbour query visits the side of each line that holds the query point first, and the far side only while the line is closer than the best point found so far, drawn as the circle.
