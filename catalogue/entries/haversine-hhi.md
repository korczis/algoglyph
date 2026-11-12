---
id: haversine-hhi
title: Radius rings and market concentration
taxonomy: geometry/geodesy
status: live
engine: geometry
sources:
  - id: practice-decisions
tags:
  - haversine
  - great circle
  - herfindahl
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: "O(n) haversine evaluations, then O(n) per ring"
related:
  - map-projections
  - h3-hex-binning
---

Great-circle distances bin competitors into rings, and the Herfindahl index measures their concentration.

The haversine formula gives the great-circle distance between two latitudes and longitudes on a sphere, here the mean Earth radius of 6371.0088 km; it stays accurate for short distances, where the spherical law of cosines loses precision. Each competitor is drawn at its true distance and initial bearing from the centre, an azimuthal equidistant view, so every ring is an exact circle.

Inside a ring the competitors' sizes become percentage shares, and the Herfindahl–Hirschman index is the sum of their squares: 10000 for a single firm, 10000 / N for N firms of equal size. The readouts turn each ring's index into that number of equal-size equivalents. The competitors and their sizes are synthetic, drawn from the plate's seed.
