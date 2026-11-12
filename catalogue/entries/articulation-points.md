---
id: articulation-points
title: Articulation points and biconnected components
taxonomy: graphs/connectivity
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - articulation points
  - biconnectivity
  - dfs
complexity: "O(V + E)"
interaction: "Tap a vertex to start from it."
related:
  - bridges
  - depth-first-search
---

The vertices whose removal disconnects the graph, and the blocks they separate.

Thick edges form the DFS tree and edges in the frontier colour are back edges. When the search ends, the articulation points are filled with the foreground colour and ringed. A vertex is one exactly when some child’s subtree has no back edge climbing above it, which is why the joints of a chain and the only link to a pendant cluster light up while vertices on cycles do not.

The readouts give the number of articulation points and of biconnected blocks: the pieces that stay connected when any single vertex is removed, which share at most one vertex with each other, always an articulation point.
