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
---

Sort by angle, then keep a stack and pop every point that makes a right turn: O(n log n).

The points are sorted by angle around the lowest point with orientation tests (one cross product orders two points, exactly, on integer coordinates), nearer first along a common ray. The scan then pushes each point and pops the top while the last three make a right turn or no turn at all, so the stack is a convex chain at every step.

Each point is pushed once and popped at most once, so the scan is linear and the sort sets the cost. The orientation count includes the sort's comparisons.
