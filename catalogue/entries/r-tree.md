---
id: r-tree
title: R-tree
taxonomy: geometry/range
status: live
engine: geometry
sources:
  - id: practice-geo
tags:
  - r-tree
  - spatial index
  - bounding boxes
motivation: Crisis maps and geospatial analysis are built from it.
complexity: "O(log n) height; insertion visits one path, a quadratic split costs O(M²)"
related:
  - grid-method
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
    - Insert a point by descending to the child whose rectangle would grow least to take it.
    - Split an overflowing node with Guttman's quadratic method, seeded by the pair of entries that would waste most area together.
    - Explain why the tree grows only at the root, so every leaf stays at the same depth, and why overlapping siblings make a query visit more than one path.
bounds:
  model: node visits and area computations
  worst: "O(log n) height; an insertion visits one path, a quadratic split costs O(M²)"
claims:
  - id: height-within-the-fill-bounds
    statement: >-
      With M = 6 (the default), at most M entries per node, at least m = ⌊0.4 M⌋ = 2 in every node but the root,
      and at least 2 children at the root, 150 points need a height h with 6^h ≥ 150 and
      2 · 2^(h − 1) ≤ 150: between ⌈log₆ 150⌉ = 3 and 1 + ⌊log₂ 75⌋ = 7.
    readout: Tree height
    expect: { range: [3, 7] }
  - id: height-at-the-lowest-fill
    statement: >-
      At a minimum fill of 0.2 and M = 6, m = max(2, ⌊0.2 · 6⌋) = 2, the default's m: the same
      bounds hold for 150 points, 6^h ≥ 150 and 2 · 2^(h − 1) ≤ 150, so the height is between
      ⌈log₆ 150⌉ = 3 and 1 + ⌊log₂ 75⌋ = 7.
    readout: Tree height
    expect: { range: [3, 7] }
    setup:
      params: { fill: 0.2 }
  - id: height-at-the-highest-fill
    statement: >-
      At a minimum fill of 0.5 and M = 6, every node but the root keeps at least m = ⌊0.5 · 6⌋ = 3 of its entries,
      so 150 points need 6^h ≥ 150 and 2 · 3^(h − 1) ≤ 150: between ⌈log₆ 150⌉ = 3 and
      1 + ⌊log₃ 75⌋ = 4, since 3³ = 27 ≤ 75 < 81.
    readout: Tree height
    expect: { range: [3, 4] }
    setup:
      params: { fill: 0.5 }
  - id: height-at-four-entries
    statement: >-
      With M = 4, m = max(2, ⌊1.6⌋) = 2, 150 points need 4^h ≥ 150 and 2 · 2^(h − 1) ≤ 150:
      between ⌈log₄ 150⌉ = 4, since 4³ = 64 < 150 ≤ 256, and 1 + ⌊log₂ 75⌋ = 7.
    readout: Tree height
    expect: { range: [4, 7] }
    setup:
      params: { M: 4 }
  - id: height-at-ten-entries
    statement: >-
      With M = 10, m = ⌊4.0⌋ = 4, 150 points need 10^h ≥ 150 and 2 · 4^(h − 1) ≤ 150: between
      ⌈log₁₀ 150⌉ = 3 and 1 + ⌊log₄ 75⌋ = 4, since 4³ = 64 ≤ 75 < 256.
    readout: Tree height
    expect: { range: [3, 4] }
    setup:
      params: { M: 10 }
  - id: height-at-sixteen-entries
    statement: >-
      With M = 16, m = ⌊6.4⌋ = 6, 150 points need 16^h ≥ 150 and 2 · 6^(h − 1) ≤ 150: between
      ⌈log₁₆ 150⌉ = 2, since 16 < 150 ≤ 256, and 1 + ⌊log₆ 75⌋ = 3, since 36 ≤ 75 < 216.
    readout: Tree height
    expect: { range: [2, 3] }
    setup:
      params: { M: 16 }
data:
  - id: points
    title: Your points
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: '1', min: -1.0e12, max: 1.0e12 }
      - { key: y, unit: '1', min: -1.0e12, max: 1.0e12 }
    rows: { min: 1, max: 800 }
    bytes: 38400
    replaces: shape
    ignores: [n]
    url_bytes: 1800
    note: Your points are mapped by one scale into the plate's box and rounded to its integer grid, where every orientation test is exact; points that round to one position are merged, and the readout counts them.
---

Nested bounding rectangles split as nodes fill: the index under spatial databases.

Each node holds at most M entries and the rectangle that bounds them. A point descends to the child whose rectangle would grow least to take it; a node that overflows splits with Guttman's quadratic method: the pair of entries that would waste most area together seeds two groups, and the rest join the group that needs the smaller enlargement, while each group keeps at least m = ⌊f · M⌋ entries (at least 2), f the minimum fill: 0.4 by default, which makes m = 2 at M = 6.

A split can climb to the root, and only then does the tree grow taller, so every leaf is always at the same depth. Rectangles are coloured by their level. The query descends only into children whose rectangles meet it; overlapping siblings are why it may visit more than one path.
