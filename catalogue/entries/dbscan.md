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
---

Clusters grow from points with enough neighbours; whatever is reached by none is noise.

A point with at least minPts points within distance eps, itself included, is a core point and is drawn larger. A cluster starts at an unlabelled core point and grows through every point within eps of one of its core points; a point reached that is not core is a border point and stops the growth there. Points that no cluster reaches remain noise, drawn faint.

Unlike #/p/k-means-plus-plus, the number of clusters is not given: it follows from eps and minPts, and a cluster may have any shape. Each neighbourhood is found here by scanning all n points, so the distance count grows as n²; the circle is the neighbourhood being queried.
