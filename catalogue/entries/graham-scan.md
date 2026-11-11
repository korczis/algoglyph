---
id: graham-scan
title: Graham scan
taxonomy: geometry/hulls
status: planned
engine: geometry
sources:
  - id: sedgewick-aic-1990
    ref: Geometric Algorithms
tags:
  - convex hull
  - angular sort
  - stack
---

Sort by angle, then keep a stack and pop every point that makes a right turn: O(n log n).
