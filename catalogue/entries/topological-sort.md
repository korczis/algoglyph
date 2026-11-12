---
id: topological-sort
title: Topological sort
taxonomy: graphs/digraphs
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - dag
  - topological order
  - dfs
complexity: "O(V + E)"
---

Reverse postorder of a DFS puts every edge pointing forward.

Vertices are coloured by their place in the final order as they finish. A vertex finishes only after everything it points to, so the last places fill first, and the vertex the first search started from finishes last and takes place 0. Every edge then runs from an earlier place to a later one.
