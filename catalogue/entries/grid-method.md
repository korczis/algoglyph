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
    - Choose the cell side so that each cell holds about two points on average (the default, which the Points per cell control changes), and drop each point into its cell with one division per coordinate.
    - Answer a rectangle query by visiting only the cells it overlaps and testing only their points, never looking at the rest.
    - Explain why on uniform points the grid is as good as any tree, while on clustered points some cells hold dozens and most hold none.
bounds:
  model: points bucketed, cells visited and points tested
  best: 'n bucketings to build; a query visits exactly the cells its rectangle overlaps and tests exactly the points in them'
  average: 'n bucketings to build; a query visits exactly the cells its rectangle overlaps and tests exactly the points in them'
  worst: 'n bucketings to build; a query visits exactly the cells its rectangle overlaps and tests exactly the points in them, all n when one cell holds them'
claims:
  - id: every-point-bucketed-at-eight-per-cell
    statement: >-
      Building the grid drops every point into exactly one cell, whatever the cell size: at a
      target of 8 points per cell the 200 points are bucketed exactly 200 times, an identity.
    readout: Points bucketed
    expect: { value: 200 }
    setup:
      params: { perCell: 8 }
  - id: every-point-bucketed-at-thirty-two-per-cell
    statement: >-
      At a target of 32 points per cell, the coarsest grid, the 200 points are still bucketed
      exactly 200 times: one bucketing per point, an identity.
    readout: Points bucketed
    expect: { value: 200 }
    setup:
      params: { perCell: 32 }
  - id: columns-at-two-per-cell
    statement: >-
      At the default 2 points per cell, 200 points in the 1600 × 1000 field give cells of side
      √(2 · 1600 · 1000 / 200) = √16000 ≈ 126.5, so the grid has ⌈1600 / 126.5⌉ = 13 columns,
      exactly.
    readout: Grid
    expect: { value: 13 }
  - id: columns-at-thirty-two-per-cell
    statement: >-
      At 32 points per cell the side is √(32 · 1600 · 1000 / 200) = √256000 ≈ 506, so the grid
      has ⌈1600 / 506⌉ = 4 columns, exactly.
    readout: Grid
    expect: { value: 4 }
    setup:
      params: { perCell: 32 }
  - id: cells-visited-at-two-per-cell
    statement: >-
      At the default 2 points per cell the side is √16000 ≈ 126.5. The query's sides are 30 % of
      the field's times 0.7 to 1.3, 336 to 624 wide and 210 to 390 high, and a span of length d
      covers ⌊d / side⌋ + 1 or + 2 cells: 3 to 6 columns and 2 to 5 rows, so 6 to 30 cells visited.
    readout: Cells visited
    expect: { range: [6, 30] }
  - id: cells-visited-at-eight-per-cell
    statement: >-
      At 8 points per cell the side is √64000 ≈ 253. The query's sides are 30 % of the field's
      times 0.7 to 1.3, 336 to 624 wide and 210 to 390 high, and a span of length d covers
      ⌊d / side⌋ + 1 or + 2 cells: 2 to 4 columns and 1 to 3 rows, so 2 to 12 cells visited.
    readout: Cells visited
    expect: { range: [2, 12] }
    setup:
      params: { perCell: 8 }
  - id: cells-visited-at-thirty-two-per-cell
    statement: >-
      At 32 points per cell the side is ≈ 506 and the grid 4 × 2. The query, 336 to 624 wide and
      210 to 390 high, covers ⌊d / side⌋ + 1 or + 2 cells per axis: 1 to 3 columns and 1 to 2
      rows (the grid's height), so 1 to 6 cells visited.
    readout: Cells visited
    expect: { range: [1, 6] }
    setup:
      params: { perCell: 32 }
data:
  - id: points
    title: Your points
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: '1', min: -1.0e12, max: 1.0e12 }
      - { key: y, unit: '1', min: -1.0e12, max: 1.0e12 }
    rows: { min: 1, max: 1500 }
    bytes: 72000
    replaces: shape
    ignores: [n]
    url_bytes: 1800
    note: Your points are mapped by one scale into the plate's box and rounded to its integer grid, where every orientation test is exact; points that round to one position are merged, and the readout counts them.
---

Bucket points into cells; a rectangle query visits only the cells it overlaps.

The cell side is chosen so that each cell holds about two points on average (the Points per cell control sets that target), and each point is dropped into its cell with one division per coordinate. A rectangle query visits the cells it overlaps, tests only their points, and never looks at the rest.

On uniform points this is as good as any tree. On clustered points some cells hold dozens and most hold none, which is what #/p/kd-tree and #/p/r-tree adapt to: compare the Points tested readout on both inputs.
