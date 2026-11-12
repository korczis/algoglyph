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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Map a point to axial hexagon coordinates by a linear map and round it in cube coordinates (q + r + s = 0) to the nearest cell centre.
    - Compare hexagons with squares of exactly the same area, and explain why the rounder hexagon has the smaller mean distance from a point to the centre of its cell.
    - Tell the planar hexagon grid from the H3 index, which tiles the globe from an icosahedron with hexagons and a few pentagons.
data:
  - id: points
    title: Your points
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: '1', min: -1.0e12, max: 1.0e12 }
      - { key: y, unit: '1', min: -1.0e12, max: 1.0e12 }
    rows: { min: 10, max: 4000 }
    bytes: 192000
    replaces: shape
    url_bytes: 1800
    note: Your points are mapped by one scale into the plate's box and rounded to its integer grid, where every orientation test is exact; points that round to one position are merged, and the readout counts them.
---

Count points in hexagonal cells, which have one kind of neighbour where squares have two.

Each point is mapped to axial hexagon coordinates by a linear map and rounded in cube coordinates (q + r + s = 0), which gives the nearest cell centre; a hexagon's colour is its count. This is the planar version of the hexagon grid: the H3 index tiles the globe from an icosahedron with hexagons and a few pentagons, which this plate does not attempt.

Squares of exactly the same area bin the same points beside the hexagons. The readouts measure the mean distance from a point to the centre of its cell for both: the hexagon is the rounder cell, so its mean is the smaller. The difference is small: at 4000 uniform points in this plate's box the hexagons' smaller mean is 3.3 standard errors, but only about 1.75 for an ideal tiling, the cells cut by the box's edge supplying the rest, so a single run cannot show it reliably. The chart counts cells by how many points they hold.
