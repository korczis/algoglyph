---
id: interior-elimination
title: Interior elimination
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
  - heuristic
complexity: "O(n) to filter, then O(m log m) for the m survivors"
related:
  - graham-scan
  - quickhull
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Find the points with the smallest and largest x + y and x − y, and see why nothing strictly inside their quadrilateral can be a hull corner.
    - Throw the interior away with one orientation test per corner of the polygon for each point (four for a quadrilateral, eight for the octagon), then run the angular-sort scan on the survivors only.
    - Predict when the filter pays, removing most of a uniform or disk-shaped set, and when it is pure overhead, removing nothing from a circle.
  prerequisites:
    - graham-scan
bounds:
  model: orientation tests
  worst: "at most k per point to filter, k the corners of the chosen polygon (4 for either quadrilateral, 8 for the octagon), kn in all (exactly k for each point eliminated), then O(m log m) for the m survivors"
claims:
  - id: most-of-a-uniform-set
    statement: >-
      On a uniform set of 160 points most points fall inside the quadrilateral of extremes:
      more than half of them, 80, are eliminated.
    readout: Points eliminated
    expect: { above: 80 }
  - id: most-of-a-disk
    statement: >-
      On 160 points in a disk most points fall inside the quadrilateral of extremes as well:
      more than half of them, 80, are eliminated.
    readout: Points eliminated
    expect: { above: 80 }
    setup:
      params: { shape: disk }
  - id: none-on-a-circle
    statement: >-
      On 160 points of a circle every point is a hull corner, so none lies strictly inside the
      quadrilateral and exactly 0 are eliminated: the filter is pure overhead.
    readout: Points eliminated
    expect: { value: 0 }
    setup:
      params: { shape: circle }
  - id: none-on-a-circle-with-the-axis-quadrilateral
    statement: >-
      With the axis quadrilateral (lowest and highest x and y) the corners are still points of the
      set, and every point of a circle is a strict hull corner, so none lies strictly inside it:
      exactly 0 are eliminated, an identity with no margin.
    readout: Points eliminated
    expect: { value: 0 }
    setup:
      params: { shape: circle, filter: axis }
  - id: none-on-a-circle-with-the-octagon
    statement: >-
      The octagon of all eight extremes is a polygon of points of the set too, so on a circle,
      where every point is a strict hull corner, exactly 0 are eliminated: an identity with no
      margin, at twice the quadrilateral's tests per point.
    readout: Points eliminated
    expect: { value: 0 }
    setup:
      params: { shape: circle, filter: octagon }
data:
  - id: points
    title: Your points
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: '1', min: -1.0e12, max: 1.0e12 }
      - { key: y, unit: '1', min: -1.0e12, max: 1.0e12 }
    rows: { min: 3, max: 2000 }
    bytes: 96000
    replaces: shape
    ignores: [n]
    url_bytes: 1800
    note: Your points are mapped by one scale into the plate's box and rounded to its integer grid, where every orientation test is exact; points that round to one position are merged, and the readout counts them.
---

Throw away the points inside a quadrilateral of extremes before computing the hull.

The points with the smallest and largest x + y and x − y are hull corners, and nothing strictly inside their quadrilateral can be one. Four orientation tests per point throw those away (the Extremes control swaps in the lowest and highest x and y, Akl and Toussaint's form, or the octagon of both, one test per corner); the dimmed points are the ones discarded, and the angular-sort scan of #/p/graham-scan runs on the rest.

On a uniform or disk-shaped set most points fall inside the quadrilateral and the sort that follows is much smaller; on a circle nothing is eliminated and the filter is pure overhead. The Points eliminated readout counts the filter's effect on the current input.
