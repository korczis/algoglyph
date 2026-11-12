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
---

Sort points by angle around an anchor and connect them into a polygon that never crosses itself.

The lowest point is the anchor; every other point lies at an angle between 0 and π from it, so one orientation test orders any two by angle, with ties broken by distance. Joining them in that order gives a polygon that is star-shaped from the anchor, and such a polygon cannot cross itself.

Points on the same ray from the anchor need care: on every ray but the last they are taken nearer first, and on the last ray farther first, or the closing edge back to the anchor would run over them. The Lattice input is full of such rays. #/p/graham-scan starts from the same order.
