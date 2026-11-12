---
id: euler-tour
title: Euler tour
taxonomy: graphs/connectivity
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - euler
  - tours
  - stack
complexity: "O(V + E)"
interaction: "Tap a vertex to start from it."
related:
  - hamilton-path
---

A walk that uses every edge exactly once, built by splicing cycles.

The input is a connected graph whose degrees are all even (the odd vertices of a nearest-neighbour graph are paired by an extra edge, or through a new midpoint vertex when they are already neighbours), which is exactly when a closed Euler tour exists.

Thick edges in the tree colour have been walked but not yet emitted; edges in the foreground colour are in the tour. The walk can only get stuck where its current cycle began; it then backs up, emitting vertices, and wherever a vertex still has unused edges a new cycle is walked and spliced in.
