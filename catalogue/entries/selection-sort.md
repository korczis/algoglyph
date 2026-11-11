---
id: selection-sort
title: Selection sort
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
  - in-place
complexity: n²/2 compares, n − 1 exchanges
---

Find the smallest remaining key and exchange it into place, left to right.

The shaded band is the unsorted remainder. Every pass scans all of it, so the number of comparisons does not depend on the input at all: try Already sorted and watch it work exactly as hard.

It makes at most n − 1 exchanges, fewer than any other sort here, which is why it still has a use when writes are expensive.
