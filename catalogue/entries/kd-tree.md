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
complexity: "O(log n) expected per insertion and per nearest-neighbour query on random points; a rectangle query visits O(√n + k) nodes when the tree is balanced"
related:
  - r-tree
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Build a 2D tree by insertion in input order, splitting on x at the root and alternating with y level by level.
    - Prune a rectangle query, which descends into a side only when the rectangle reaches it.
    - Prune a nearest-neighbour query, which visits the far side of a line only while the line is closer than the best point found so far.
bounds:
  model: node visits
  average: O(log n) expected per insertion and per nearest-neighbour query on random points
  worst: O(√n + k) per rectangle query reporting k points, when the tree is balanced
data:
  - id: points
    title: Your points
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: '1', min: -1.0e12, max: 1.0e12 }
      - { key: y, unit: '1', min: -1.0e12, max: 1.0e12 }
    rows: { min: 1, max: 800 }
    bytes: 38400
    replaces: shape
    ignores: [n]
    url_bytes: 1800
    note: Your points are mapped by one scale into the plate's box and rounded to its integer grid, where every orientation test is exact; points that round to one position are merged, and the readout counts them.
---

Split alternately on x and y: rectangle and nearest-neighbour queries prune whole halves.

Points are inserted in input order. The root splits the field with a vertical line through its point, its children split their halves with horizontal lines, and the levels alternate from there; a key smaller than the node's goes low, anything else high. Each line is drawn across the cell it divides.

The rectangle query descends into a side only when the rectangle reaches it; the shaded cells are the nodes it visited, and the Range query visits readout counts them. The nearest-neighbour query visits the side of each line that holds the query point first, and the far side only while the line is closer than the best point found so far, drawn as the circle.
