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
complexity: "O(n log n) expected for random points; Lawson flips are O(n²) in the worst case"
related:
  - voronoi-relax
  - euclidean-mst
  - closest-pair
---

The regions closest to each site, and the triangulation that is their dual.

Points are inserted in x order, so each new one lies outside the triangulation built so far; it is joined to every hull edge it can see, and each edge opposite it is tested: if the point across lies inside the circumcircle of the new triangle, the edge is flipped and the two edges behind it are tested in turn. When no edge is illegal, every triangle's circumcircle is empty of other points: the Delaunay property.

Coordinates are integers, so both the orientation and the in-circle determinants are exact in double precision, and the flips terminate. The Voronoi diagram is drawn as the dual: each triangle gives its circumcentre, each interior edge joins the circumcentres on its two sides, and each hull edge sends a ray outward.
