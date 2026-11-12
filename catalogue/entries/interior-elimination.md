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
    - Throw the interior away with four orientation tests per point, then run the angular-sort scan on the survivors only.
    - Predict when the filter pays, removing most of a uniform or disk-shaped set, and when it is pure overhead, removing nothing from a circle.
  prerequisites:
    - graham-scan
bounds:
  model: orientation tests
  worst: "at most 4 per point to filter, 4n in all (exactly 4 for each point eliminated), then O(m log m) for the m survivors"
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
---

Throw away the points inside a quadrilateral of extremes before computing the hull.

The points with the smallest and largest x + y and x − y are hull corners, and nothing strictly inside their quadrilateral can be one. Four orientation tests per point throw those away; the dimmed points are the ones discarded, and the angular-sort scan of #/p/graham-scan runs on the rest.

On a uniform or disk-shaped set most points fall inside the quadrilateral and the sort that follows is much smaller; on a circle nothing is eliminated and the filter is pure overhead. The Points eliminated readout counts the filter's effect on the current input.
