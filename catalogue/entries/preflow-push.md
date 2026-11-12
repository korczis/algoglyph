---
id: preflow-push
title: Preflow-push
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
  - push relabel
complexity: "O(V³) with a FIFO queue of active vertices"
---

Flood the network from the source and push excess downhill until it drains.

Vertices are coloured by height; ringed ones hold excess. At the start the source, at height V, saturates every edge it has (a preflow); active vertices then push downhill along residual arcs, or are lifted just above their lowest residual neighbour.

Flow first overshoots towards the sink, then the excess that cannot get there climbs above the source’s height and drains back. The chart’s active-vertex count reaches zero when no excess is left, and the flow is then a maximum one, with the minimum cut filled and drawn as at the end of Ford–Fulkerson.
