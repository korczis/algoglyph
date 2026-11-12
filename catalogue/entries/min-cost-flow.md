---
id: min-cost-flow
title: Minimum-cost flow
taxonomy: graphs/flows
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - min cost flow
  - negative cycles
complexity: "O(VE) per cancelled cycle (Bellman–Ford); with integer costs the cycles are finite"
related:
  - bellman-ford
---

A maximum flow whose cost is reduced by cancelling negative cycles in the residual graph.

Each edge has a capacity and a cost per unit from 1 to 9. The plate first finds a maximum flow by shortest augmenting paths, then repeatedly finds a negative-cost cycle in the residual network and pushes flow round it; the cycle flashes in the foreground colour.

The flow value in the chart stays flat while the cost falls; the readouts give the final cost and how many cycles were cancelled.
