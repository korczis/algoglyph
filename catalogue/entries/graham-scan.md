---
id: graham-scan
title: Graham scan
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
  - angular sort
  - stack
complexity: "O(n log n), dominated by the angular sort"
related:
  - simple-closed-path
  - gift-wrapping
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Sort the points by angle around the lowest point with orientation tests, one cross product ordering two points exactly on integer coordinates, nearer first along a common ray.
    - Keep a stack and pop the top while the last three points make a right turn or no turn at all, so the stack is a convex chain at every step.
    - Explain why the scan is linear, each point pushed once and popped at most once, so the angular sort sets the cost.
bounds:
  model: orientation tests, the angular sort's comparisons included
  worst: 'O(n log n), set by the angular sort; the scan itself pops n − h points and makes at most 2(n − 2) orientation tests, each point pushed once and popped at most once'
claims:
  - id: every-circle-point-a-corner
    statement: >-
      On a circle all of the default 160 points are hull vertices: the input keeps its points a
      strictly convex ring (every turn strictly left, by the exact test on its grid), so the scan
      pops none and the hull has exactly n vertices, an identity with no margin.
    readout: Hull vertices
    expect: { value: 160, tolerance: 0 }
    setup:
      params: { shape: circle }
data:
  - id: points
    title: Your points
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: '1', min: -1.0e12, max: 1.0e12 }
      - { key: y, unit: '1', min: -1.0e12, max: 1.0e12 }
    rows: { min: 3, max: 1000 }
    bytes: 48000
    replaces: shape
    ignores: [n]
    url_bytes: 1800
    note: Your points are mapped by one scale into the plate's box and rounded to its integer grid, where every orientation test is exact; points that round to one position are merged, and the readout counts them.
---

Sort by angle, then keep a stack and pop every point that makes a right turn: O(n log n).

The points are sorted by angle around the lowest point with orientation tests (one cross product orders two points, exactly, on integer coordinates), nearer first along a common ray. The scan then pushes each point and pops the top while the last three make a right turn or no turn at all, so the stack is a convex chain at every step.

Each point is pushed once and popped at most once, so the scan is linear and the sort sets the cost. The orientation count includes the sort's comparisons.
