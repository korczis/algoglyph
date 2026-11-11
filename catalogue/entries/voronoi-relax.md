---
id: voronoi-relax
title: Lloyd's Stained Glass
taxonomy: geometry/proximity
status: live
engine: custom
tags:
  - computational geometry
  - Voronoi
  - Lloyd
complexity: O(pixels) per frame, bucket search
interaction: Click to add a seed.
---

Random seeds split the plane into Voronoi cells; Lloyd's algorithm walks each seed to its cell's centroid until the glass settles into an even honeycomb.

Every pixel belongs to its nearest seed. The labelling uses a bucket grid searched in rings around each pixel and stops once no farther ring can hold a closer seed, so it is exact, not approximate.

Each frame, every seed moves part of the way towards the centroid of the pixels it owns. The readout's quantisation energy (mean squared distance from a pixel to its seed) falls as the tessellation relaxes towards a centroidal Voronoi diagram.

Click the glass to drop a new seed and watch the neighbours make room.
