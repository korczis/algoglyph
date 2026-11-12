---
id: orthogonal-sweep
title: Sweep line for orthogonal segments
taxonomy: geometry/intersection
status: live
engine: geometry
sources:
  - id: sedgewick-aic-1990
    ref: Geometric Algorithms
tags:
  - sweep line
  - intersection
  - bst
complexity: "O(n log n + k) expected for k intersections, with an unbalanced search tree on random heights"
related:
  - bst-delete-join
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Move a vertical line from left to right through the segment ends, sorted once by x.
    - Keep the horizontal segments the line crosses in a binary search tree keyed by height, inserted at the left end and removed at the right end by Hibbard deletion.
    - Answer each vertical segment with a range query that reports exactly the horizontals whose height it spans.
bounds:
  model: tree node visits and comparisons
  average: O(n log n + k) expected for k intersections, with an unbalanced search tree on random heights
claims:
  - id: two-events-per-horizontal-one-per-vertical
    statement: >-
      A horizontal segment is an event at its left end and another at its right end, a vertical
      one is a single range query; the 60 segments of the input alternate, 30 horizontal and 30
      vertical, so the sweep handles exactly 2 · 30 + 30 = 90 events.
    readout: Events
    expect: { value: 90 }
---

A vertical line sweeps across, holding the horizontal segments it crosses in a search tree.

A vertical line moves from left to right through the segment ends, sorted once by x. A horizontal segment enters a binary search tree keyed by its height at its left end and leaves at its right end (Hibbard deletion); the highlighted segments are the ones in the tree. Each vertical segment is a range query on the tree, which reports exactly the horizontal segments whose height it spans.

The input has real coordinates, so no two ends share an x and no two horizontals share a height; the tree is not balanced, which on random heights still gives logarithmic depth on average.
