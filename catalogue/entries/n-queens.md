---
id: n-queens
title: Eight queens by backtracking
taxonomy: foundations/exhaustive
status: live
engine: grid
sources:
  - id: sedgewick-aic-1990
    ref: Advanced Topics
tags:
  - backtracking
  - constraint search
complexity: "exponential in n; the 8 x 8 board has 92 solutions"
---

Place queens row by row, back up the moment one is attacked, and count the dead ends.

Queens go down one row at a time. In each row every column is tried; a square is taken only if no queen above it shares its column or either diagonal, which the search keeps as three sets of flags. When a row has no free square left, the queen above it is taken back and moved on: a backtrack.

The search does not stop at the first solution. It runs to the end of the tree and frames the board at each complete placement, so the readout reaches the problem's known solution count: 92 for eight queens.

The bar under each square counts how often it was tried. The chart breaks the effort down by row: most queens are placed and taken back in the rows just past the middle, because near the top there are few partial boards to extend and near the bottom few of them survive.
