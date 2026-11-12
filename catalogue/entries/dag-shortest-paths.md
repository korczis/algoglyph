---
id: dag-shortest-paths
title: Shortest paths in a DAG
taxonomy: graphs/shortest-paths
status: live
engine: graph
labs:
  - shortest-paths
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - dag
  - shortest paths
  - topological order
complexity: "O(V + E)"
interaction: "Tap a vertex to start from it."
related:
  - topological-sort
  - bellman-ford
---

Relax edges in topological order: linear time, negative weights allowed.

First a topological order: vertices are ringed as they join it. Then one pass in that order relaxes each vertex’s out-edges exactly once and fills it; vertices are coloured by distance.

The signed input has weights from −8 to 12, where Dijkstra’s greedy settling could go wrong, and the result still matches Bellman–Ford. In the shortest-paths lab, on the layered DAG, compare its relaxations with Bellman–Ford’s rounds.
