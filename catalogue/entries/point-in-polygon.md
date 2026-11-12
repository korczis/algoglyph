---
id: point-in-polygon
title: Point in polygon
taxonomy: geometry/primitives
status: live
engine: geometry
sources:
  - id: sedgewick-aic-1990
    ref: Geometric Algorithms
tags:
  - polygons
  - ray casting
  - inclusion
complexity: "O(m) per query for a polygon of m edges"
related:
  - ccw-intersection
  - simple-closed-path
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Decide inclusion by the parity of the crossings of a horizontal ray from the point to the right; odd is inside.
    - Count an edge only when one end is strictly above the ray and the other on or below it, so a vertex on the ray is counted once, not twice.
    - Tell whether a crossing lies right of the point with a single orientation test.
bounds:
  model: edges examined
  worst: "O(m) per query for a polygon of m edges: every query examines all m"
---

Count how often a ray from the point crosses the boundary: odd is inside.

A horizontal ray runs from the query point to the right, and the point is inside when the ray crosses the boundary an odd number of times. An edge counts when one end is strictly above the ray and the other on or below it, so a vertex lying on the ray is counted once, not twice; whether the crossing is to the right of the point is a single orientation test.

The comb input has deep teeth, so a ray can cross the boundary many times; the step readout shows the count for the current point, and its parity is the answer.
