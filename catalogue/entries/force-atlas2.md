---
id: force-atlas2
title: ForceAtlas2 layout
taxonomy: graphs/layout
status: live
engine: graph
sources:
  - id: practice-investigation
tags:
  - force-directed
  - layout
  - barnes-hut
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(V² + E) per iteration with exact repulsion; O(V log V + E) with Barnes–Hut"
related:
  - geo-graph
  - sugiyama-layout
---

Repulsion between all vertices, attraction along edges and gravity to the centre, settling into a readable map.

Vertices start scattered at random and every iteration moves all of them; the outer rings show the input’s known groups where it has them. On the three-communities input the rings sort themselves into clusters, since attraction grows linearly with distance while repulsion falls off only as 1/d.

The chart shows the total swing, which falls as vertices stop oscillating. Raise gravity to pull the clusters closer together.
