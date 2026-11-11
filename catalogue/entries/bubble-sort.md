---
id: bubble-sort
title: Bubble sort
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
  - in-place
complexity: n²/2 compares worst case
---

Exchange neighbours that are out of order, pass after pass, until a pass changes nothing.

Each pass carries the largest remaining key to the end of the band; small keys near the end ("turtles") move only one place per pass.

The early exit makes it linear on sorted input, and it is still slower than insertion sort on everything else.
