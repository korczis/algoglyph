---
id: closest-pair
title: Closest pair by divide and conquer
taxonomy: geometry/proximity
status: live
engine: geometry
sources:
  - id: sedgewick-aic-1990
    ref: Geometric Algorithms
tags:
  - closest pair
  - divide and conquer
complexity: "O(n log n)"
related:
  - voronoi-diagram
  - kd-tree
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
    - mergesort-top-down
  objectives:
    - Find the closest pair by splitting at the median, solving each half recursively and handing each half back sorted by y, by a merge.
    - Explain why only points closer to the dividing line than the best distance so far can improve it, and why in y order each strip point is compared only with those above it still within that distance.
    - Use the packing argument to bound the combine step as linear, and set the distance computations made against the n(n − 1)/2 a brute-force search needs.
algorithm:
  paradigm: divide-and-conquer
bounds:
  model: distance computations
  worst: O(n log n)
claims:
  - id: fewer-distances-than-brute-force
    statement: >-
      For the default 160 uniform points the divide and conquer makes fewer distance computations
      than the n(n − 1)/2 = 12720 of a brute-force search. The margin is a hard bound, not a sample:
      the leaves of at most three points make at most n distance computations between them, and by
      the packing argument each strip point is compared with at most seven others, so each of the
      six combine levels adds at most 7n: at most 160 + 6 · 7 · 160 = 6880, below 12720.
    readout: Distance computations
    expect: { against: Brute force would compute, below: 0 }
  - id: within-the-bound-at-leaves-of-two
    statement: >-
      With leaves of at most L = 2 points the leaves make at most n(L − 1)/2 = 80 distance
      computations, and halving 160 points until no part exceeds 2 (160, 80, 40, 20, 10, 5, 3)
      takes seven combine levels of at most 7n = 1120 each: at most 80 + 7 · 1120 = 7920, a hard
      bound.
    readout: Distance computations
    expect: { range: [0, 7920] }
    setup:
      params: { leaf: 2 }
  - id: fewer-distances-than-brute-force-at-leaves-of-two
    statement: >-
      That bound of 7920 is below the 12720 of a brute-force search, so with leaves of two points
      the divide and conquer still makes fewer distance computations than brute force.
    readout: Distance computations
    expect: { against: Brute force would compute, below: 0 }
    setup:
      params: { leaf: 2 }
---

Split at the median, solve each half, and check only a strip around the cut.

Points are sorted by x once. Each half is solved recursively and handed back sorted by y, by a merge, as in #/p/mergesort-top-down. Only points closer to the dividing line than the best distance so far can improve it; that strip is shaded, and in y order each strip point is compared only with those above it that are still within the best distance.

A packing argument bounds how many points can sit in the strip within that distance of each other, so the combine step is linear. The readout sets the distance computations made against the n(n − 1)/2 a brute-force search needs. The leaf size, below which a range compares every pair, is a control of 2 or 3 points: at 2000 points any larger leaf would make more distance computations than the plate's heaviest run does today.
