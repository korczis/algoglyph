---
id: voronoi-diagram
title: Voronoi diagram and Delaunay triangulation
taxonomy: geometry/proximity
status: live
engine: geometry
sources:
  - id: sedgewick-aic-1990
    ref: Geometric Algorithms
tags:
  - voronoi
  - delaunay
  - duality
complexity: "O(n²) flips in the worst case; O(n log n) expected with a randomised insertion order, which this plate does not use"
related:
  - voronoi-relax
  - euclidean-mst
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
    - Insert points in x order, so each new one lies outside the triangulation so far, and join it to every hull edge it can see.
    - Flip an edge while the point across lies inside the new triangle's circumcircle, until every circumcircle is empty of other points.
    - Draw the Voronoi diagram as the dual, one circumcentre per triangle, one edge across every interior edge and a ray out of every hull edge.
algorithm:
  paradigm: incremental
bounds:
  model: edge flips
  worst: O(n²) flips, in this plate's x order
claims:
  - id: one-voronoi-vertex-per-triangle
    statement: >-
      Each triangle gives its circumcentre, so the Voronoi diagram has exactly as many vertices
      as the triangulation has triangles: the difference is 0.
    readout: Voronoi vertices
    expect: { against: Triangles, tolerance: 0 }
---

The regions closest to each site, and the triangulation that is their dual.

Points are inserted in x order, so each new one lies outside the triangulation built so far; it is joined to every hull edge it can see, and each edge opposite it is tested: if the point across lies inside the circumcircle of the new triangle, the edge is flipped and the two edges behind it are tested in turn. When no edge is illegal, every triangle's circumcircle is empty of other points: the Delaunay property.

Coordinates are integers, so both the orientation and the in-circle determinants are exact in double precision, and the flips terminate. The Voronoi diagram is drawn as the dual: each triangle gives its circumcentre, each interior edge joins the circumcentres on its two sides, and each hull edge sends a ray outward.
