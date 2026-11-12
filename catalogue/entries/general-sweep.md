---
id: general-sweep
title: Sweep line for general segments
taxonomy: geometry/intersection
status: live
engine: geometry
sources:
  - id: sedgewick-aic-1990
    ref: Geometric Algorithms
tags:
  - sweep line
  - intersection
  - events
complexity: "O((n + k) log n) for k crossings with a balanced status tree; the status here is a sorted array, so an insertion also moves O(n) entries"
related:
  - ccw-intersection
  - orthogonal-sweep
---

Every crossing among n segments found by a sweep that reorders neighbours at each intersection.

Bentley and Ottmann's sweep. Left ends, right ends and discovered crossings leave one priority queue in x order. The status is the list of segments the sweep line cuts, ordered by height and coloured by rank. Two segments that cross must be neighbours in that list just before the crossing, so only neighbours are ever tested: a new segment against the two around it, the pair that closes up when one leaves, and at a crossing the swapped pair against their new neighbours.

Each pair is scheduled at most once. The segments have real coordinates in general position (no vertical segment, no three through a point); the sweep is exact for that input, and the orientation tests it makes grow with n + k rather than with n², so on Short segments, where crossings are few, its measured growth stays well below the quadratic all-pairs test of #/p/ccw-intersection.
