---
id: yen-k-shortest
title: Yen's k shortest paths
taxonomy: graphs/shortest-paths
status: live
engine: graph
sources:
  - id: practice-investigation
tags:
  - k shortest paths
  - alternatives
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(k V E log V) with a binary heap"
interaction: "Tap a vertex to start from it."
related:
  - dijkstra
  - credible-path
---

The best path, then the best that differs from it, and so on, by spur paths.

The best path from the circled source to the boxed target is drawn in the foreground colour, every further path in the tree colour. Between paths the plate runs one Dijkstra per spur vertex of the last path found, so ringed and filled vertices flicker through many small searches; the readouts count their edge examinations and relaxations.

The path costs appear in order at the end. Equal costs are possible, every path is loopless, and no two are the same.
