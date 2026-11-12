---
id: dijkstra
title: Dijkstra's algorithm
taxonomy: graphs/shortest-paths
status: live
engine: graph
labs:
  - shortest-paths
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - shortest paths
  - greedy
  - priority queue
complexity: "O(E log V) with a binary heap"
interaction: "Tap a vertex to start from it."
related:
  - prim-mst
---

Settle vertices in order of distance, relaxing the edges of each one settled.

Vertices are coloured by their tentative distance from the circled source; ringed ones are in the queue, filled ones settled. Thick edges are the current shortest-path tree, re-pointed whenever a relaxation improves a distance (the improving count in the readouts).

On the grid the weights are random digits, so the settled region is ragged where breadth-first search draws a clean diamond; on the geometric input the weights are lengths and it grows as a rough disc. Weights must not be negative, which is why the signed inputs are offered to Bellman–Ford and not here.
