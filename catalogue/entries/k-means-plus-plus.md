---
id: k-means-plus-plus
title: k-means++
taxonomy: geometry/clustering
status: live
engine: geometry
sources:
  - id: practice-investigation
tags:
  - clustering
  - k-means
  - seeding
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(nk) per Lloyd iteration and O(nk) for the seeding"
related:
  - dbscan
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Seed each further centre with probability proportional to its squared distance from the nearest centre chosen so far, and see why far-off groups very likely receive a centre of their own.
    - Explain why assigning every point to its nearest centre and moving every centre to the mean of its points can each only lower the sum of squared distances.
    - Read the inertia per iteration, which never rises, and stop when no point changes cluster.
algorithm:
  paradigm: iterative-refinement
bounds:
  model: distance computations
  worst: "O(nk) for the seeding and O(nk) per Lloyd iteration: (k − 1)n and nk exactly"
claims:
  - id: stops-when-nothing-moves
    statement: >-
      The run stops when no point changes cluster, not at the default cap of 100 Lloyd
      iterations: for 400 clustered points and k = 5 it converges in fewer than 100.
    readout: Iterations to converge
    expect: { below: 100 }
  - id: one-iteration-at-a-cap-of-one
    statement: >-
      The first Lloyd iteration moves every point from "unassigned" to its nearest centre, so it
      can never be the last; with the cap at 1 the run stops after exactly 1 iteration, at the cap.
    readout: Iterations to converge
    expect: { value: 1 }
    setup:
      params: { maxIter: 1 }
  - id: two-iterations-at-a-cap-of-two
    statement: >-
      A run makes min(cap, iterations to converge) Lloyd iterations, and iterations to converge
      is never below 2: the first iteration moves every point off "unassigned", so it is never
      the last. With the cap at 2 the run therefore makes exactly 2.
    readout: Iterations to converge
    expect: { value: 2 }
    setup:
      params: { maxIter: 2 }
  - id: exact-distances-at-a-cap-of-two
    statement: >-
      Seeding 5 centres costs (k − 1)n = 1600 distance computations and each Lloyd iteration nk =
      2000, so a run stopped at the cap of 2 makes exactly 1600 + 2 · 2000 = 5600.
    readout: Distance computations
    expect: { value: 5600 }
    setup:
      params: { maxIter: 2 }
---

Seed centres far apart, then alternate assignment and averaging until nothing moves.

The first centre is a point drawn uniformly at random; each further centre is a point drawn with probability proportional to its squared distance from the nearest centre chosen so far, which is the dot size during seeding. Far-off groups are therefore very likely to receive a centre of their own, and the expected cost of the seeding alone is within a factor O(log k) of the optimum.

Then Lloyd's iterations alternate two steps, each of which can only lower the sum of squared distances: assign every point to its nearest centre, then move every centre to the mean of its points. The chart is that sum per iteration, measured; it never rises, and the run stops when no point changes cluster, or at the iteration cap, a control that is 100 by default and lets the first few iterations be watched alone. The seed of the plate fixes the random draws.
