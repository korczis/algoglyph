---
id: brandes-betweenness
title: Betweenness centrality (Brandes)
taxonomy: graphs/analysis
status: live
engine: graph
labs:
  - centrality
sources:
  - id: practice-investigation
tags:
  - betweenness
  - brokers
  - centrality
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(VE) for unweighted graphs"
related:
  - centrality-comparison
  - pagerank
---

How many shortest paths pass through each vertex, accumulated backwards from every source.

Vertex size and colour show betweenness so far; each round is one source’s breadth-first search, ringed as it spreads, followed by the backward accumulation. Edge weights are ignored and paths are counted in hops.

On the three-communities input the vertices at the ends of the few edges between communities stand out, because every shortest path from one community to another runs through them.
