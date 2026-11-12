---
id: gift-wrapping
title: Gift wrapping
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
  - jarvis march
complexity: "O(nh) orientation tests for h hull vertices; O(n²) when every point is on the hull"
related:
  - graham-scan
  - quickhull
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Walk around the set from the lowest point, each step keeping the candidate that has all the others on its left, with one orientation test per point and no angles or division.
    - Explain why, among candidates on one line, the farthest wins, so points in the middle of a hull edge are never taken as corners.
    - Relate the work to the hull, n − 2 orientation tests for every hull vertex, so quick on a uniform set and quadratic On a circle, where every point is a corner.
bounds:
  model: orientation tests
  best: 'h(n − 2) for h hull vertices: each step tests every point but its current vertex and its first candidate'
  average: 'h(n − 2); on a uniform set h is small'
  worst: 'n(n − 2), when every point is a corner (On a circle)'
claims:
  - id: every-circle-point-a-corner
    statement: >-
      On a circle every one of the default 160 points is a corner: the input keeps its points a
      strictly convex ring (every turn strictly left, by the exact test on its grid), so the march
      takes all n as hull vertices, an identity with no margin.
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
    url_bytes: 1800
    note: Your points are mapped by one scale into the plate's box and rounded to its integer grid, where every orientation test is exact; points that round to one position are merged, and the readout counts them.
---

Walk around the set, each step taking the point that makes the smallest turn: O(nh).

Starting from the lowest point, each step scans every point and keeps the candidate that has all the others on its left: one orientation test per point, no angles and no division. Among candidates on one line the farthest wins, so points in the middle of a hull edge are never taken as corners.

The work is n − 2 orientation tests for every hull vertex, one for each point but the current vertex and its first candidate. On a uniform set the hull is small and the march is quick; choose On a circle and every point is a corner, and the measured growth exponent of the chart climbs to 2.
