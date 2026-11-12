---
id: ccw-intersection
title: Orientation and segment intersection
taxonomy: geometry/primitives
status: live
engine: geometry
sources:
  - id: sedgewick-aic-1990
    ref: Geometric Algorithms
tags:
  - orientation
  - ccw
  - segments
complexity: "four orientation tests per pair, 2n(n − 1) for n segments"
related:
  - general-sweep
  - orthogonal-sweep
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Read the orientation of three points from the sign of one cross product, positive for a left turn, negative for a right turn and zero when they are collinear.
    - Decide whether two segments cross from whether the endpoints of each lie strictly on opposite sides of the other's line, and when a test is zero, whether that endpoint lies within the other segment.
    - Explain why the test needs no slope and no division, so vertical and collinear segments need no special case.
bounds:
  model: orientation tests
  best: '2n(n − 1): four for each of the n(n − 1)/2 pairs of n segments, whatever the input'
  average: '2n(n − 1)'
  worst: '2n(n − 1)'
---

Whether three points turn left, and from that, whether two segments cross.

The orientation of three points is the sign of one cross product: positive for a left turn, negative for a right turn, zero when they are collinear. Two segments cross exactly when the endpoints of each lie strictly on opposite sides of the other's line; when one of these tests is zero, they touch exactly when that endpoint lies within the other segment. There is no slope and no division, so vertical and collinear segments need no special case.

This plate tests every pair, so the work is fixed by n alone; the sweeps of #/p/general-sweep and #/p/orthogonal-sweep find the same pairs while testing only segments that become neighbours. The Lattice input puts endpoints on a coarse grid, where segments share endpoints, touch and overlap along a line: on integer coordinates every test is exact.
