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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Compute the great-circle distance between two latitudes and longitudes with the haversine formula, and explain why it stays accurate for short distances, where the spherical law of cosines loses precision.
    - Compute a ring's Herfindahl–Hirschman index as the sum of its competitors' squared percentage shares, 10000 for a single firm and 10000 / N for N firms of equal size.
    - Read a ring's index as the number of equal-size equivalents it stands for.
claims:
  - id: equal-sizes-ten-km-ring
    statement: >-
      With the size spread σ at 0 every competitor has size 1, so the k competitors within 10 km
      each hold 100 / k percent and the ring's index is k · (100 / k)² = 10000 / k: its equal-size
      equivalents (the readout's third number) equal its competitor count (its first), an
      identity with no margin.
    readout: Within 10 km
    expect: { against: Within 10 km, against_number: 3, tolerance: 0 }
    setup:
      params: { spread: 0 }
  - id: equal-sizes-sixty-km-ring
    statement: >-
      With σ at 0 the 60 km ring, which holds every competitor (none is drawn farther than 60
      km), has an index of exactly 10000 / k for its k competitors, so k equal-size equivalents:
      the readout's third number equals its first, an identity with no margin.
    readout: Within 60 km
    expect: { against: Within 60 km, against_number: 3, tolerance: 0 }
    setup:
      params: { spread: 0 }
  - id: unequal-sizes-at-most-k-equivalents
    statement: >-
      At σ = 2 the sizes are far apart, but for k competitors the index is never below 10000 / k
      (the sum of squared shares is least when they are equal), so the 60 km ring's equal-size
      equivalents never exceed its competitor count: count minus equivalents is at least 0, and
      the margin of 0.05 is half the equivalents' last printed digit.
    readout: Within 60 km
    expect: { against: Within 60 km, against_number: 3, above: -0.05 }
    setup:
      params: { spread: 2 }
  - id: unequal-sizes-at-least-one-equivalent
    statement: >-
      At σ = 2 the index of a ring is never above 10000, a single firm holding everything, so the
      60 km ring of all 60 competitors stands for at least one equal-size equivalent: count minus
      equivalents is at most 60 − 1 = 59, and the margin of 0.05 is half the equivalents' last
      printed digit.
    readout: Within 60 km
    expect: { against: Within 60 km, against_number: 3, below: 59.05 }
    setup:
      params: { spread: 2 }
---

Great-circle distances bin competitors into rings, and the Herfindahl index measures their concentration.

The haversine formula gives the great-circle distance between two latitudes and longitudes on a sphere, here the mean Earth radius of 6371.0088 km; it stays accurate for short distances, where the spherical law of cosines loses precision. Each competitor is drawn at its true distance and initial bearing from the centre, an azimuthal equidistant view, so every ring is an exact circle.

Inside a ring the competitors' sizes become percentage shares, and the Herfindahl–Hirschman index is the sum of their squares: 10000 for a single firm, 10000 / N for N firms of equal size. The readouts turn each ring's index into that number of equal-size equivalents. The competitors and their sizes are synthetic, drawn from the plate's seed; the size spread σ sets how unequal the sizes are, and at σ = 0 every ring of N firms reads 10000 / N.
