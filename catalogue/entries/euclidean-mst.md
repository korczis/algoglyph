---
id: euclidean-mst
title: Euclidean minimum spanning tree
taxonomy: graphs/spanning-trees
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - mst
  - geometry
  - delaunay
complexity: "O(n²) here (Bowyer–Watson insertion); O(n log n) with a faster triangulation"
related:
  - kruskal-mst
relations:
  - { type: uses, target: bowyer-watson-delaunay, reason: "The graph it spans is the Delaunay triangulation, built by Bowyer–Watson insertion." }
---

The MST of points in the plane, found among the edges of their Delaunay triangulation.

Every pair of points is an edge of the input, but none is drawn until the triangulation is done. Then its edges appear and Kruskal runs on them alone, ordered by true length: kept edges join fragments and recolour them, the rest fade.

The tree is the minimum spanning tree of all n(n − 1)/2 pairs, while only the triangulation’s edges are ever examined, as the edge-examined readout shows.
