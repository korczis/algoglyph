---
id: bipartite-matching
title: Bipartite matching
taxonomy: graphs/flows
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - matching
  - bipartite
  - augmenting paths
complexity: "O(V E)"
related:
  - ford-fulkerson
---

Pair up two sides along alternating paths, as a flow problem in disguise.

The two columns are the two sides. For each left vertex in turn, a depth-first search follows any edge to the right and the matched edge back (ringed as it goes) until it finds a free right vertex; the alternating path is then flipped, and the matching, drawn thick, grows by one.

A left vertex that fails once never succeeds later, so one pass over the left side is enough.
