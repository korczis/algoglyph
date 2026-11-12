---
id: ford-fulkerson
title: Augmenting paths (Ford–Fulkerson)
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
  - augmenting paths
  - cuts
complexity: "O(E f) for integer capacities, f the maximum flow"
related:
  - preflow-push
  - min-cost-flow
---

Push flow along any path with spare capacity until none is left; the saturated edges form a cut.

The source is circled on the left, the sink boxed on the right; an edge’s thickness and colour show its flow against its capacity. Each round a depth-first search over the residual network (ringed as it explores) finds a path with spare room and pushes its bottleneck.

When no such path is left, the vertices still reachable are filled: one side of a minimum cut, and the saturated edges leaving it are drawn as the cut. The flow value equals the cut’s capacity, the max-flow min-cut theorem.
