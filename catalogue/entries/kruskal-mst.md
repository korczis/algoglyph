---
id: kruskal-mst
title: Kruskal's algorithm
taxonomy: graphs/spanning-trees
status: live
engine: graph
labs:
  - spanning-trees
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - mst
  - greedy
  - union-find
complexity: "O(E log E)"
related:
  - path-compression
  - prim-mst
  - boruvka-mst
---

Take edges cheapest first, skipping any that would close a cycle.

Edges are taken cheapest first. One that joins two fragments becomes a tree edge and the smaller fragment takes the larger one’s colour; one that would close a cycle fades out. The fragment count in the chart falls by one with every tree edge, and the highlighted edge is the one just examined.
