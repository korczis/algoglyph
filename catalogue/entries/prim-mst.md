---
id: prim-mst
title: Prim's algorithm
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
  - priority queue
complexity: "O(E log V) with a binary heap"
interaction: "Tap a vertex to start from it."
related:
  - dijkstra
  - kruskal-mst
---

Grow one tree, always adding the cheapest edge leaving it.

The tree grows from the circled source: filled vertices are in it, ringed ones wait in the queue keyed by their cheapest edge to the tree, which is drawn in the frontier colour until a cheaper one replaces it.

It is the same priority-queue loop as Dijkstra, keyed by one edge’s weight instead of a path’s length, so from the same source it grows a different tree. On a disconnected input it spans each component in turn.
