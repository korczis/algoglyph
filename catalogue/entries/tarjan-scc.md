---
id: tarjan-scc
title: Strong components (Tarjan)
taxonomy: graphs/digraphs
status: planned
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - strong components
  - dfs
  - low link
motivation: Link analysis in investigations and due diligence leans on it.
related:
  - ownership-cycles
  - kosaraju-scc
---

One DFS with a stack and low links pops each strong component as it completes.
