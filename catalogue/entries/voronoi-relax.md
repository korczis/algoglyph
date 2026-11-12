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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Label every pixel by its nearest seed exactly, with a bucket grid searched in rings that stops once no farther ring can hold a closer seed.
    - Move every seed part of the way towards the centroid of the pixels it owns, Lloyd's step, and watch the tessellation relax towards a centroidal Voronoi diagram.
    - Read the quantisation energy, the mean squared distance from a pixel to its seed, as the quantity the relaxation lowers.
algorithm:
  paradigm: iterative-refinement
claims:
  - id: energy-falls
    statement: >-
      From the clustered start of the default seeds, the quantisation energy when the relaxation
      stops is below the energy at the start. No sampling margin is needed: a Lloyd step cannot
      raise the energy, since moving a seed part of the way towards the centroid of its pixels
      lowers their summed squared distance to it, and relabelling every pixel to its nearest seed
      lowers it again.
    readout: 'quantisation energy, start → now'
    expect: { against: 'quantisation energy, start → now', against_number: 2, above: 0 }
sources:
  - id: lloyd-1982-quantization
    ref: the method, for scalar quantization
  - id: du-faber-gunzburger-1999-cvt
    ref: centroidal Voronoi tessellations in the plane, and Lloyd's method for them
---

Random seeds split the plane into Voronoi cells; Lloyd's algorithm walks each seed to its cell's centroid until the glass settles into an even honeycomb.

Every pixel belongs to its nearest seed. The labelling uses a bucket grid searched in rings around each pixel and stops once no farther ring can hold a closer seed, so it is exact, not approximate.

Each frame, every seed moves part of the way towards the centroid of the pixels it owns. This is the two-dimensional generalisation of Lloyd's method for scalar quantisation: its fixed point is a centroidal Voronoi tessellation, in which every seed sits at the centroid of its own cell. The readout's quantisation energy (mean squared distance from a pixel to its seed), shown at the start beside its current value, falls as the tessellation relaxes towards it; the relaxation stops once the largest seed shift in a step falls below ε, or when its step budget is spent, and the Stopped readout says which.

Click the glass to drop a new seed and watch the neighbours make room.
