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
  - kd-tree
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
---

Nested bounding rectangles split as nodes fill: the index under spatial databases.

Each node holds at most M entries and the rectangle that bounds them. A point descends to the child whose rectangle would grow least to take it; a node that overflows splits with Guttman's quadratic method: the pair of entries that would waste most area together seeds two groups, and the rest join the group that needs the smaller enlargement, while each group keeps at least m = ⌊0.4 M⌋ entries (2 at M = 6).

A split can climb to the root, and only then does the tree grow taller, so every leaf is always at the same depth. Rectangles are coloured by their level. The query descends only into children whose rectangles meet it; overlapping siblings are why it may visit more than one path.
