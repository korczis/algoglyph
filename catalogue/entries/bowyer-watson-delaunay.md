---
id: bowyer-watson-delaunay
title: 'Empty Circles: Bowyer–Watson Delaunay'
taxonomy: geometry/proximity
status: live
engine: custom
sources:
  - id: bowyer-dirichlet
  - id: watson-delaunay
  - id: de-berg-cgaa
    ref: 'Chapter 9: Delaunay Triangulations'
tags:
  - computational geometry
  - Delaunay
  - Voronoi
  - Bowyer–Watson
complexity: O(1) expected cavity; walks of about √n triangles in random order
interaction: Click to insert a point.
related:
  - voronoi-diagram
---

Bowyer–Watson insertion builds a Delaunay triangulation one point at a time, on exact lattice predicates: each point tears out every triangle whose circumcircle it falls inside and stitches the hole shut.

Each new point walks from the last triangle built towards itself, crossing any edge it lies beyond, until it stands in a triangle. Every triangle whose circumcircle strictly contains the point is then removed (the highlighted cavity, with its circles) and the point is joined to the cavity's rim. What remains has empty circumcircles: the Delaunay triangulation, in which no edge flip can raise the smallest angle.

Points sit on a 4096 × 4096 integer lattice, so the orientation and in-circle determinants are exact in double precision and ties (collinear or cocircular points) are decided by rule, not rounding. The super-triangle is pushed to infinity: each hull edge closes into a ghost triangle with one symbolic vertex, whose "circle" is the open half-plane beyond the edge.

With n points, h of them on the hull, the mesh has 2n − 2 − h triangles and 3n − 3 − h edges, so V − E + F = 2 with the outer face counted; the readouts count them from the mesh. The Voronoi toggle joins circumcentres across shared edges: the dual diagram. Click to add a point.
