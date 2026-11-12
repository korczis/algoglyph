---
id: pagerank
title: PageRank
taxonomy: graphs/analysis
status: live
engine: graph
labs:
  - centrality
sources:
  - id: practice-investigation
tags:
  - pagerank
  - power iteration
  - influence
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(E) per round; the error shrinks by a factor d per round"
related:
  - personalised-pagerank
---

Influence as the stationary distribution of a random surfer who sometimes teleports.

Vertex size and colour show rank. The scores start uniform and each round passes them along the edges (both ways on undirected inputs); the total change falls by about the damping factor per round, a straight line on the log chart, until it drops below 1e-12.

Lower the damping and the ranks converge faster and flatten towards uniform; raise it and the structure of the graph dominates. The readouts check that the scores sum to one.
