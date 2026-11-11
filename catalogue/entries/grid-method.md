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
---

Bucket points into cells; a rectangle query visits only the cells it overlaps.

The cell side is chosen so that each cell holds about two points on average, and each point is dropped into its cell with one division per coordinate. A rectangle query visits the cells it overlaps, tests only their points, and never looks at the rest.

On uniform points this is as good as any tree. On clustered points some cells hold dozens and most hold none, which is what the 2D tree and the R-tree adapt to: compare the Points tested readout on both inputs.
