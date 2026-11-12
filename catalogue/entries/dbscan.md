---
id: dbscan
title: DBSCAN
taxonomy: geometry/clustering
status: live
engine: geometry
sources:
  - id: practice-investigation
tags:
  - clustering
  - density
  - noise
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(n²) with the linear-scan neighbourhoods used here; a spatial index brings each query down to its neighbours"
related:
  - k-means-plus-plus
  - grid-method
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Classify points as core (at least minPts points within eps, itself included), border (reached by a cluster but not core) and noise (reached by none).
    - Grow a cluster from an unlabelled core point through every point within eps of one of its core points, stopping at border points.
    - Explain why the number of clusters is not given but follows from eps and minPts, and why a cluster may have any shape.
bounds:
  model: distance computations, with neighbourhoods found by a linear scan
  best: 'n²: every point is queried once (n neighbourhood queries), each a scan of all n points'
  average: 'n²'
  worst: 'n²'
data:
  - id: points
    title: Your points
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: '1', min: -1.0e12, max: 1.0e12 }
      - { key: y, unit: '1', min: -1.0e12, max: 1.0e12 }
    rows: { min: 10, max: 1200 }
    bytes: 57600
    replaces: shape
    ignores: [n]
    url_bytes: 1800
    note: Your points are mapped by one scale into the plate's box and rounded to its integer grid, where every orientation test is exact; points that round to one position are merged, and the readout counts them.
---

Clusters grow from points with enough neighbours; whatever is reached by none is noise.

A point with at least minPts points within distance eps, itself included, is a core point and is drawn larger. A cluster starts at an unlabelled core point and grows through every point within eps of one of its core points; a point reached that is not core is a border point and stops the growth there. Points that no cluster reaches remain noise, drawn faint.

Unlike #/p/k-means-plus-plus, the number of clusters is not given: it follows from eps and minPts, and a cluster may have any shape. Each neighbourhood is found here by scanning all n points, so the distance count grows as n²; the circle is the neighbourhood being queried.
