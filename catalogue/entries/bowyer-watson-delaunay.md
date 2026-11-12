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
complexity: 'O(1) expected cavity; walks of about √n triangles in random order (the visited / insertion readout counts walk steps and cavity tests together)'
interaction: Click to insert a point.
related:
  - voronoi-diagram
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
    - Build a Delaunay triangulation one point at a time, tearing out every triangle whose circumcircle strictly contains the new point and joining the point to the cavity's rim.
    - Explain why exact lattice predicates let ties between collinear or cocircular points be decided by rule, not by rounding.
    - Check the mesh against its counts, 2n − 2 − h triangles and 3n − 3 − h edges for n points with h on the hull, so that V − E + F = 2 with the outer face counted.
algorithm:
  paradigm: incremental
claims:
  - id: euler-characteristic
    statement: >-
      Counted from the finished mesh of the default clustered points, vertices minus edges plus
      faces, the outer face included, is exactly 2: Euler's formula for a connected planar graph,
      an identity with no margin.
    readout: V − E + F
    expect: { value: 2, tolerance: 0 }
  - id: triangles-two-n-minus-two-minus-h
    statement: >-
      The finished mesh of the default clustered points has exactly 2n − 2 − h triangles, h the
      hull vertices: the triangles the readout counts from the mesh equal the formula it prints
      beside them (its fourth number), an identity with no margin.
    readout: triangles
    expect: { against: triangles, against_number: 4, tolerance: 0 }
---

Bowyer–Watson insertion builds a Delaunay triangulation one point at a time, on exact lattice predicates: each point tears out every triangle whose circumcircle it falls inside and stitches the hole shut.

Each new point walks from the last triangle built towards itself, crossing any edge it lies beyond, until it stands in a triangle. Every triangle whose circumcircle strictly contains the point is then removed (the highlighted cavity, with its circles) and the point is joined to the cavity's rim. What remains has empty circumcircles: the Delaunay triangulation, in which no edge flip can raise the smallest angle.

Points sit on a 4096 × 4096 integer lattice, so the orientation and in-circle determinants are exact in double precision and ties (collinear or cocircular points) are decided by rule, not rounding. The super-triangle is pushed to infinity: each hull edge closes into a ghost triangle with one symbolic vertex, whose "circle" is the open half-plane beyond the edge.

With n points, h of them on the hull, the mesh has 2n − 2 − h triangles and 3n − 3 − h edges, so V − E + F = 2 with the outer face counted; the readouts count them from the mesh. The Voronoi toggle joins circumcentres across shared edges: the dual diagram. Click to add a point.
