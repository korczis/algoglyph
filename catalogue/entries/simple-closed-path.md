---
id: simple-closed-path
title: Simple closed path
taxonomy: geometry/primitives
status: live
engine: geometry
sources:
  - id: sedgewick-aic-1990
    ref: Geometric Algorithms
tags:
  - polygons
  - angular sort
complexity: "O(n log n), the angular sort"
related:
  - graham-scan
  - point-in-polygon
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Order the points by angle around the lowest one with one orientation test per pair, breaking ties by distance.
    - Explain why joining them in that order gives a polygon star-shaped from the anchor, which cannot cross itself.
    - Take the points on the last ray farther first, so the closing edge back to the anchor does not run over them.
bounds:
  model: orientation tests
  worst: O(n log n), the angular sort
data:
  - id: points
    title: Your points
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: '1', min: -1.0e12, max: 1.0e12 }
      - { key: y, unit: '1', min: -1.0e12, max: 1.0e12 }
    rows: { min: 3, max: 1500 }
    bytes: 72000
    replaces: shape
    url_bytes: 1800
    note: Your points are mapped by one scale into the plate's box and rounded to its integer grid, where every orientation test is exact; points that round to one position are merged, and the readout counts them.
---

Sort points by angle around an anchor and connect them into a polygon that never crosses itself.

The lowest point is the anchor; every other point lies at an angle between 0 and π from it, so one orientation test orders any two by angle, with ties broken by distance. Joining them in that order gives a polygon that is star-shaped from the anchor, and such a polygon cannot cross itself.

Points on the same ray from the anchor need care: on every ray but the last they are taken nearer first, and on the last ray farther first, or the closing edge back to the anchor would run over them. The Lattice input is full of such rays. #/p/graham-scan starts from the same order.
