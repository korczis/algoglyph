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
---

Throw away the points inside a quadrilateral of extremes before computing the hull.

The points with the smallest and largest x + y and x − y are hull corners, and nothing strictly inside their quadrilateral can be one. Four orientation tests per point throw those away; the dimmed points are the ones discarded, and the angular-sort scan of #/p/graham-scan runs on the rest.

On a uniform or disk-shaped set most points fall inside the quadrilateral and the sort that follows is much smaller; on a circle nothing is eliminated and the filter is pure overhead. The Points eliminated readout counts the filter's effect on the current input.
