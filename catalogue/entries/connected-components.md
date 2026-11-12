---
id: connected-components
title: Connected components
taxonomy: graphs/connectivity
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - components
  - dfs
complexity: "O(V + E)"
related:
  - union-find-entity-merge
  - kosaraju-scc
---

Label every vertex with the component a search from it reaches.

Each search labels one component with a colour of its own; hollow vertices are not reached yet and ringed ones wait on the stack. The Separate islands input has several components by construction; the random sparse input usually has one large component and a few small ones; the geometric and grid inputs are connected.
