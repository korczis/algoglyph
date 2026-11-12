---
id: bellman-ford
title: Bellman–Ford
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
  - negative weights
  - relaxation
complexity: "O(VE)"
interaction: "Tap a vertex to start from it."
related:
  - dijkstra
  - dag-shortest-paths
  - floyd-warshall
---

Relax every edge V − 1 times; one more round that still improves reveals a negative cycle.

Each round relaxes every edge out of a reached vertex; vertices are coloured by their current distance, and the chart shows how much the distances fell in each round, reaching zero when they are final, which ends the rounds early.

On the negative-cycle input a three-vertex cycle whose weights sum below zero is planted, round V still improves a distance, and the negative cycle found by walking parent edges back is drawn in the foreground colour, its vertices marked. The signed input has negative edges but, by construction, no negative cycle.
