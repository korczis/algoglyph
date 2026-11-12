---
id: hamilton-path
title: Hamilton path by backtracking
taxonomy: graphs/connectivity
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - backtracking
  - np-complete
  - paths
complexity: "exponential in the worst case; the problem is NP-complete"
---

A path through every vertex once, found by exhaustive search with backtracking.

Ringed vertices form the path being tried, joined by thick edges; every retreat clears the last vertex. Neighbours with the fewest free neighbours are tried first, a path is abandoned as soon as its end can no longer reach every remaining vertex, and the first complete path is drawn in the foreground colour.

A rectangular grid always has one (row by row, like a snake). A vertex of degree one can only be an end, so three of them rule a path out at once. Raise the vertex count on the geometric input and watch the discoveries and events grow far faster than the graph; a run that reaches the event cap stops and says so.
