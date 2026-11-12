---
id: tarjan-scc
title: Strong components (Tarjan)
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
  - low link
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(V + E)"
related:
  - ownership-cycles
  - kosaraju-scc
---

One DFS with a stack and low links pops each strong component as it completes.

Ringed vertices are waiting on the component stack; a vertex takes its component’s colour only when the whole component is popped, at the moment the search leaves the component’s root (the vertex whose low link equals its own discovery time).

Components come out in reverse topological order: no component has an edge into one popped after it. In the strong-components lab it runs beside Kosaraju on the same graph with one search instead of two.
