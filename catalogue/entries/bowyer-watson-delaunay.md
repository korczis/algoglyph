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
  - id: euler-characteristic-coarse-lattice
    statement: >-
      On the 64 × 64 lattice the default clustered points merge (the duplicates are skipped, so n
      counts the distinct vertices) and many line up, yet the finished mesh is still a connected
      planar graph: vertices minus edges plus faces, the outer face included, is exactly 2, an
      identity with no margin.
    readout: V − E + F
    expect: { value: 2, tolerance: 0 }
    setup:
      params: { lattice: '64' }
  - id: triangles-two-n-minus-two-minus-h-coarse-lattice
    statement: >-
      On the 64 × 64 lattice the finished mesh has exactly 2n − 2 − h triangles, n the vertices
      left after duplicates and h every point on the hull's boundary, collinear ones included (the
      plate counts one ghost triangle per hull edge): the triangles counted from the mesh equal
      the formula printed beside them (its fourth number), an identity with no margin.
    readout: triangles
    expect: { against: triangles, against_number: 4, tolerance: 0 }
    setup:
      params: { lattice: '64' }
  - id: euler-characteristic-256-lattice
    statement: >-
      On the 256 × 256 lattice, vertices minus edges plus faces of the finished mesh, the outer
      face included, is exactly 2, an identity with no margin.
    readout: V − E + F
    expect: { value: 2, tolerance: 0 }
    setup:
      params: { lattice: '256' }
  - id: triangles-two-n-minus-two-minus-h-256-lattice
    statement: >-
      On the 256 × 256 lattice the finished mesh has exactly 2n − 2 − h triangles, n the vertices
      left after duplicates and h the points on the hull's boundary: the triangles counted from
      the mesh equal the formula printed beside them (its fourth number), an identity with no
      margin.
    readout: triangles
    expect: { against: triangles, against_number: 4, tolerance: 0 }
    setup:
      params: { lattice: '256' }
---

Bowyer–Watson insertion builds a Delaunay triangulation one point at a time, on exact lattice predicates: each point tears out every triangle whose circumcircle it falls inside and stitches the hole shut.

Each new point walks from the last triangle built towards itself, crossing any edge it lies beyond, until it stands in a triangle. Every triangle whose circumcircle strictly contains the point is then removed (the highlighted cavity, with its circles) and the point is joined to the cavity's rim. What remains has empty circumcircles: the Delaunay triangulation, in which no edge flip can raise the smallest angle.

Points sit on an integer lattice, 4096 × 4096 unless the lattice control picks a coarser one (4096 is the largest on which the arithmetic stays exact), so the orientation and in-circle determinants are exact in double precision and ties (collinear or cocircular points) are decided by rule, not rounding. The super-triangle is pushed to infinity: each hull edge closes into a ghost triangle with one symbolic vertex, whose "circle" is the open half-plane beyond the edge.

With n points, h of them on the hull, the mesh has 2n − 2 − h triangles and 3n − 3 − h edges, so V − E + F = 2 with the outer face counted; the readouts count them from the mesh. The Voronoi toggle joins circumcentres across shared edges: the dual diagram. Click to add a point.
