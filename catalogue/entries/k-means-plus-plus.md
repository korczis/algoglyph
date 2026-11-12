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
      The run stops when no point changes cluster, not at the plate's cap of 100 Lloyd
      iterations: for 400 clustered points and k = 5 it converges in fewer than 100.
    readout: Iterations to converge
    expect: { below: 100 }
data:
  - id: points
    title: Your points
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: '1', min: -1.0e12, max: 1.0e12 }
      - { key: y, unit: '1', min: -1.0e12, max: 1.0e12 }
    rows: { min: 10, max: 2000 }
    bytes: 96000
    replaces: shape
    ignores: [n]
    url_bytes: 1800
    note: Your points are mapped by one scale into the plate's box and rounded to its integer grid, where every orientation test is exact; points that round to one position are merged, and the readout counts them.
---

Seed centres far apart, then alternate assignment and averaging until nothing moves.

The first centre is a point drawn uniformly at random; each further centre is a point drawn with probability proportional to its squared distance from the nearest centre chosen so far, which is the dot size during seeding. Far-off groups are therefore very likely to receive a centre of their own, and the expected cost of the seeding alone is within a factor O(log k) of the optimum.

Then Lloyd's iterations alternate two steps, each of which can only lower the sum of squared distances: assign every point to its nearest centre, then move every centre to the mean of its points. The chart is that sum per iteration, measured; it never rises, and the run stops when no point changes cluster. The seed of the plate fixes the random draws.
