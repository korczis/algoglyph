---
id: map-projections
title: Web Mercator and Křovák projections
taxonomy: geometry/geodesy
status: live
engine: geometry
sources:
  - id: practice-geo
tags:
  - projections
  - mercator
  - krovak
  - distortion
motivation: Crisis maps and geospatial analysis are built from it.
complexity: "O(1) per projected point; the Křovák inverse iterates its latitude to convergence"
related:
  - haversine-hhi
---

How two projections bend the same graticule, measured by their distortion at each point.

Web Mercator (EPSG:3857) applies the spherical Mercator formulas, on a sphere of radius 6378137 m, to geodetic coordinates; on that sphere it is conformal with scale sec φ, so across these few degrees of latitude its scale already changes by several per cent. Křovák (EPSG:5514) maps the Bessel 1841 ellipsoid conformally onto a Gaussian sphere, rotates that sphere so the axis of its cone becomes the pole, and projects onto a cone with one standard parallel at 78°30' of the rotated latitude, scaled by 0.9999.

Both are measured the same way at every node: central differences give the scale along the meridian (h) and along the parallel (k) against the surface each projection is defined on, and the angle between the projected meridian and parallel. A conformal projection keeps h = k and that angle at 90°, which the readouts confirm to rounding error. Colour is k within each map; the smallest Křovák scale lies on the pseudo standard parallel, and EPSG:5514 turns the classical southing and westing into a north-up plane, in which the meridians lean because the cone's axis lies at 24°50' E, east of the area. Coordinates are taken as Bessel latitudes and longitudes: no datum shift from WGS 84 is applied.
