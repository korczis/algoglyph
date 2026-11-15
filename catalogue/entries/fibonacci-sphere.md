---
id: fibonacci-sphere
title: Fibonacci sphere layout
taxonomy: graphs/layout
status: live
engine: graph
sources:
  - id: practice-investigation
tags:
  - sphere
  - golden angle
  - 3d
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(V + E)"
interaction: "Tap a vertex to start the placement from it."
related:
  - force-atlas2
---

Points spread evenly on a sphere by the golden angle, a stable home for a 3D graph.

The sphere turns slowly; nearer vertices are drawn larger and edges fainter towards the back. Vertices take the points in breadth-first order from the circled source, so neighbours tend to sit on nearby turns of the spiral.

The readouts compare the mean chord length of the edges with the mean chord over every pair of the n points, which is what the edges would measure on average if the vertices took the points in a random order. That baseline tends to 4/3, the mean distance between two random points on the unit sphere, only as n grows; on a handful of points it is well above 4/3, so an edge chord above 4/3 can still beat a random assignment.
