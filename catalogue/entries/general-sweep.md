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
relations:
  - { type: uses, target: binary-heap, reason: "Left ends, right ends and discovered crossings leave one priority queue, a binary heap." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites:
    - ccw-intersection
  objectives:
    - Run Bentley and Ottmann's sweep, in which left ends, right ends and discovered crossings leave one priority queue in x order and the status lists the segments the sweep line cuts, ordered by height.
    - Explain why two segments that cross must be neighbours in the status just before the crossing, so that only neighbours are ever tested.
    - Relate the orientation tests to n + k rather than n², and compare them on Short segments with the quadratic all-pairs test of ccw-intersection.
bounds:
  model: orientation tests and event pops, for n segments with k crossings
  average: 'O((n + k) log n) time with a balanced status tree; 2n + k event pops (each pair is scheduled at most once) and at most 4(3n + 2k) orientation tests'
  worst: 'O((n + k) log n) time with a balanced status tree (here a sorted array, so an insertion also moves O(n) entries); 2n + k event pops and at most 4(3n + 2k) orientation tests'
claims:
  - id: short-segments-below-all-pairs
    statement: >-
      On 300 Short segments the sweep makes fewer orientation tests than the 2n(n − 1) = 179400
      the all-pairs test of ccw-intersection makes. The margin is a hard bound: a left end tests
      its two neighbours, a right end the pair that closes up and a crossing its two new pairs, at
      four orientation tests a pair, so at most 4(3n + 2k); segments of mean length 95 in the
      1520 × 920 field cross about C(300, 2) · 2 · 95² / (π · 1520 · 920) ≈ 184 times, which puts
      the bound near 5100.
    readout: Orientation tests
    expect: { below: 179400 }
    setup:
      params: { n: 300 }
---

Every crossing among n segments found by a sweep that reorders neighbours at each intersection.

Bentley and Ottmann's sweep. Left ends, right ends and discovered crossings leave one priority queue in x order. The status is the list of segments the sweep line cuts, ordered by height and coloured by rank. Two segments that cross must be neighbours in that list just before the crossing, so only neighbours are ever tested: a new segment against the two around it, the pair that closes up when one leaves, and at a crossing the swapped pair against their new neighbours.

Each pair is scheduled at most once. The segments have real coordinates in general position (no vertical segment, no three through a point); the sweep is exact for that input, and the orientation tests it makes grow with n + k rather than with n², so on Short segments, where crossings are few, its measured growth stays well below the quadratic all-pairs test of #/p/ccw-intersection.
