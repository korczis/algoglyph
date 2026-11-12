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
---

Seed centres far apart, then alternate assignment and averaging until nothing moves.

The first centre is a point drawn uniformly at random; each further centre is a point drawn with probability proportional to its squared distance from the nearest centre chosen so far, which is the dot size during seeding. Far-off groups are therefore very likely to receive a centre of their own, and the expected cost of the seeding alone is within a factor O(log k) of the optimum.

Then Lloyd's iterations alternate two steps, each of which can only lower the sum of squared distances: assign every point to its nearest centre, then move every centre to the mean of its points. The chart is that sum per iteration, measured; it never rises, and the run stops when no point changes cluster. The seed of the plate fixes the random draws.
