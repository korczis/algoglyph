---
id: grid-method
title: Range search with a grid
taxonomy: geometry/range
status: live
engine: geometry
sources:
  - id: sedgewick-aic-1990
    ref: Geometric Algorithms
tags:
  - range search
  - grid
  - buckets
complexity: "O(n) to build; a query costs the cells it overlaps plus the points in them"
related:
  - kd-tree
  - h3-hex-binning
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Choose the cell side so that each cell holds about two points on average, and drop each point into its cell with one division per coordinate.
    - Answer a rectangle query by visiting only the cells it overlaps and testing only their points, never looking at the rest.
    - Explain why on uniform points the grid is as good as any tree, while on clustered points some cells hold dozens and most hold none.
bounds:
  model: points bucketed, cells visited and points tested
  best: 'n bucketings to build; a query visits exactly the cells its rectangle overlaps and tests exactly the points in them'
  average: 'n bucketings to build; a query visits exactly the cells its rectangle overlaps and tests exactly the points in them'
  worst: 'n bucketings to build; a query visits exactly the cells its rectangle overlaps and tests exactly the points in them, all n when one cell holds them'
---

Bucket points into cells; a rectangle query visits only the cells it overlaps.

The cell side is chosen so that each cell holds about two points on average, and each point is dropped into its cell with one division per coordinate. A rectangle query visits the cells it overlaps, tests only their points, and never looks at the rest.

On uniform points this is as good as any tree. On clustered points some cells hold dozens and most hold none, which is what #/p/kd-tree and #/p/r-tree adapt to: compare the Points tested readout on both inputs.
