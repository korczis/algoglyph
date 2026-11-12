---
id: louvain-leiden
title: Louvain and Leiden communities
taxonomy: graphs/analysis
status: live
engine: graph
labs:
  - communities
sources:
  - id: practice-investigation
tags:
  - communities
  - modularity
  - clustering
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(E) per sweep of local moving"
---

Move vertices to the neighbour community that most raises modularity, then contract and repeat.

Colours are communities, the outer rings the input’s known ones. The first level moves single vertices; later levels move whole contracted communities, so blocks of vertices change colour together. The chart’s modularity rises sweep by sweep.

Leiden (Traag, Waltman and van Eck) splits every community into well-connected parts before contracting, to avoid communities whose members are not connected inside them, a known failure of Louvain. Here the refinement is greedy: each vertex joins the best well-connected subcommunity rather than one drawn at random.
