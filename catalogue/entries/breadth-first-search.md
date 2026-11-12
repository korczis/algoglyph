---
id: breadth-first-search
title: Breadth-first search
taxonomy: graphs/search
status: live
engine: graph
labs:
  - graph-search
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - bfs
  - graph search
  - queue
complexity: "O(V + E)"
interaction: "Tap a vertex to start from it."
related:
  - depth-first-search
  - ego-network
  - dijkstra
---

Visit vertices in order of distance, a queue holding the frontier.

Vertices are coloured by their distance in hops from the circled source; ringed vertices are still on the queue, the thick edges form the BFS tree (each joins a vertex to one a hop nearer), and the highlighted edges are the last ones examined. Edge weights play no part.

On the grid the visited region is a diamond, because hop distance on a grid is the Manhattan distance. On the small-world input a few rewired edges act as shortcuts, so the number of levels (the Rounds readout) stays small for the size of the ring. A directed input reaches only what the source’s out-edges lead to.
