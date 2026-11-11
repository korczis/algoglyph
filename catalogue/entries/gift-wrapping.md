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
---

Walk around the set, each step taking the point that makes the smallest turn: O(nh).

Starting from the lowest point, each step scans every point and keeps the candidate that has all the others on its left: one orientation test per point, no angles and no division. Among candidates on one line the farthest wins, so points in the middle of a hull edge are never taken as corners.

The work is n for every hull vertex. On a uniform set the hull is small and the march is quick; choose On a circle and every point is a corner, and the measured growth exponent of the chart climbs to 2.
