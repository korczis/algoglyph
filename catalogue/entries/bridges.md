---
id: bridges
title: Bridges
taxonomy: graphs/connectivity
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - bridges
  - edge connectivity
  - dfs
complexity: "O(V + E)"
interaction: "Tap a vertex to start from it."
---

The edges whose removal disconnects the graph, found from DFS low points.

The same depth-first search with low points: thick edges are the tree, edges in the frontier colour are back edges. When the search ends the bridges are drawn thickest. A tree edge is a bridge exactly when nothing below it has a back edge reaching its upper end or above; any edge on a cycle survives.

On the geometric input the bridges are mostly the edges that hold a pendant vertex or a small cluster to the rest; on the small-world ring there are usually none, because every edge lies on some cycle around the ring.
