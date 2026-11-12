---
id: edmonds-karp
title: Shortest augmenting paths (Edmonds–Karp)
taxonomy: graphs/flows
status: live
engine: graph
labs:
  - max-flow
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - max flow
  - bfs
complexity: "O(V E²)"
related:
  - ford-fulkerson
  - preflow-push
---

Augment along the shortest path each time, which bounds the rounds by VE/2.

The same drawing as Ford–Fulkerson, but each search is breadth-first, so every augmenting path has as few edges as possible. In the max-flow lab both run on one network: the final flow value agrees, while the paths taken and the number of rounds generally differ.
