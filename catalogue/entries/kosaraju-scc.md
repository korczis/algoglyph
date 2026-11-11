---
id: kosaraju-scc
title: Strong components (Kosaraju)
taxonomy: graphs/digraphs
status: live
engine: graph
labs:
  - strong-components
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - strong components
  - dfs
  - reverse graph
complexity: "O(V + E)"
related:
  - tarjan-scc
  - transitive-closure
---

A DFS on the reverse graph, then one on the graph in reverse postorder: each tree is a strong component.

The first pass walks the edges backwards and fills vertices as they finish. Then every vertex is cleared, and the second pass, taking roots in reverse finishing order, paints each tree it grows a colour of its own: vertices that can reach each other share a colour.

On the layered DAG every component is a single vertex, since no vertex of a DAG reaches back to itself; on the directed input with cycles the reverse edges glue larger components together.
