---
id: floyd-warshall
title: Floyd–Warshall
taxonomy: graphs/shortest-paths
status: live
engine: graph
labs:
  - shortest-paths
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - all pairs
  - shortest paths
  - matrix
complexity: "O(V³)"
related:
  - transitive-closure
  - dijkstra
  - bellman-ford
---

All-pairs distances, improved through one intermediate vertex at a time.

The matrix holds d[i][j], coloured from short to long and blank where no path is known yet. Round k lets paths pass through the ringed vertex k; the outlined cell is the last one improved. The matrix-write count counts improvements only, while the inner loop always runs V³ times.

Negative weights are fine as long as no cycle is negative (the signed inputs): the result matches a Bellman–Ford run from every vertex. A negative entry on the diagonal at the end would reveal a negative cycle, and its vertices would be marked.
