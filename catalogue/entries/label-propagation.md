---
id: label-propagation
title: Label propagation
taxonomy: graphs/analysis
status: live
engine: graph
labs:
  - communities
sources:
  - id: practice-investigation
tags:
  - communities
  - label propagation
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(E) per round"
related:
  - louvain-leiden
---

Every vertex adopts the most common label among its neighbours until the labels settle.

Every vertex starts in a colour of its own; the outer rings show the input’s known communities where it has them. Each round shuffles the vertices and lets each adopt the commonest label among its neighbours.

The chart shows the labels in use collapsing over the first rounds, the readouts the modularity of the current labels. Ties are broken at random, so different seeds can settle into different partitions, and one label can take over two true communities.
