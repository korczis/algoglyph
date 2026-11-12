---
id: geo-graph
title: Graph over a map
taxonomy: graphs/layout
status: live
engine: graph
sources:
  - id: practice-geo
tags:
  - geospatial
  - force-directed
  - maps
motivation: Crisis maps and geospatial analysis are built from it.
complexity: "O(V² + E) per iteration"
---

A force layout whose vertices are pulled towards their places on a map.

The small squares are the vertices’ places on the map, and a faint line ties each vertex to its place. The layout starts on a circle; the chart shows the total distance from the map, iteration by iteration.

Set the pull to 0 and only the graph’s own forces act; at 1 the vertices settle near their places and the edges that join distant places stay long.
