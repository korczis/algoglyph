---
id: h3-hex-binning
title: Hexagonal binning
taxonomy: geometry/range
status: live
engine: geometry
sources:
  - id: practice-geo
tags:
  - hexagons
  - binning
  - aggregation
motivation: Crisis maps and geospatial analysis are built from it.
complexity: "O(1) per point"
related:
  - grid-method
---

Count points in hexagonal cells, which have one kind of neighbour where squares have two.

Each point is mapped to axial hexagon coordinates by a linear map and rounded in cube coordinates (q + r + s = 0), which gives the nearest cell centre; a hexagon's colour is its count. This is the planar version of the hexagon grid: the H3 index tiles the globe from an icosahedron with hexagons and a few pentagons, which this plate does not attempt.

Squares of exactly the same area bin the same points beside the hexagons. The readouts measure the mean distance from a point to the centre of its cell for both: the hexagon is the rounder cell, so its mean is the smaller. The chart counts cells by how many points they hold.
