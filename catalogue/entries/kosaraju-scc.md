---
id: kosaraju-scc
title: Strong components (Kosaraju)
taxonomy: graphs/digraphs
status: planned
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - strong components
  - dfs
  - reverse graph
---

A DFS on the reverse graph, then one on the graph in reverse postorder: each tree is a strong component.
