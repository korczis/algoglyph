---
id: shaker-sort
title: Cocktail shaker sort
taxonomy: sorting/elementary
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - quadratic
  - stable
  - bidirectional
  - in-place
complexity: n²/2 compares worst case
related:
  - bubble-sort
---

Bubble sort that alternates direction, so small keys travel left as fast as large keys travel right.

The band shrinks from both ends, each end moving to the last exchange it saw. Organ pipe input shows the turtles it rescues.
