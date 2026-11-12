---
id: boruvka-mst
title: Borůvka's algorithm
taxonomy: graphs/spanning-trees
status: live
engine: graph
labs:
  - spanning-trees
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - mst
  - parallel
  - components
complexity: "O(E log V)"
related:
  - kruskal-mst
  - prim-mst
---

Every component takes its cheapest outgoing edge at once, and the components at least halve.

Each round scans every edge once, every fragment picks its cheapest edge to another fragment, and all the picks join at once. On a connected input the fragment count in the chart at least halves per round, so there are at most log₂ V rounds.

Ties are broken by edge index, which keeps the simultaneous picks from closing a cycle; the grid input, whose weights are digits and tie often, is the place to see that matter.
