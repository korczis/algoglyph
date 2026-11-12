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
---

Nested bounding rectangles split as nodes fill: the index under spatial databases.

Each node holds at most M entries and the rectangle that bounds them. A point descends to the child whose rectangle would grow least to take it; a node that overflows splits with Guttman's quadratic method: the pair of entries that would waste most area together seeds two groups, and the rest join the group that needs the smaller enlargement, while each group keeps at least m = 0.4 M entries.

A split can climb to the root, and only then does the tree grow taller, so every leaf is always at the same depth. Rectangles are coloured by their level. The query descends only into children whose rectangles meet it; overlapping siblings are why it may visit more than one path.
