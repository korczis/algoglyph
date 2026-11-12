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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
    - See Web Mercator's scale sec φ, which changes by several per cent across a few degrees of latitude, against Křovák's, held near 0.9999.
    - Measure the scale along the meridian (h) and along the parallel (k), and the angle between the projected meridian and parallel, by central differences.
    - Recognise a conformal projection by h = k and a right angle at every node, and find Křovák's smallest scale on the pseudo standard parallel.
claims:
  - id: mercator-scale-is-sec-phi
    statement: >-
      On its sphere Web Mercator has scale sec φ, so its smallest k over the graticule, at
      48.5° N, is sec 48.5° = 1.50916: 1.5092 within 0.0001, the readout's four decimals and the
      central differences' error of about 1e-10.
    readout: Web Mercator scale k
    expect: { value: 1.5092, tolerance: 0.0001 }
  - id: mercator-is-conformal
    statement: >-
      Web Mercator keeps h = k: the largest |h/k − 1| is the central differences' truncation
      error, H²/6 · (tan²φ + sec²φ) ≤ 6.9e-11 for the step H = 1e-5 rad, plus about 1e-11 of
      rounding; below 1e-9, a dozen times that.
    readout: Largest |h/k − 1|, Mercator / Křovák
    expect: { below: 1e-9 }
  - id: krovak-is-conformal
    statement: >-
      Křovák keeps h = k as well: its largest |h/k − 1| (the readout's second number) is within
      1e-9 of Mercator's, so with Mercator's below 1e-9 it is below 2e-9, the same order of
      truncation error.
    readout: Largest |h/k − 1|, Mercator / Křovák
    expect: { against: 'Largest |h/k − 1|, Mercator / Křovák', against_number: 2, tolerance: 1e-9 }
  - id: mercator-angle-is-exactly-right
    statement: >-
      Web Mercator's x depends only on longitude and its y only on latitude, so the projected
      meridian and parallel steps are exactly perpendicular: an angle error of exactly 0°.
    readout: Largest meridian–parallel angle error
    expect: { value: 0 }
  - id: krovak-angle-is-right
    statement: >-
      Křovák's meridians and parallels meet at 90° to the central differences' error: an O(H²)
      = 1e-10 rad error is about 6e-9°, and its angle error (the readout's second number, against
      Mercator's exact 0) stays within 1e-7°, allowing a factor of about 17 for the derivatives.
    readout: Largest meridian–parallel angle error
    expect: { against: Largest meridian–parallel angle error, against_number: 2, tolerance: 1e-7 }
  - id: krovak-smallest-scale-on-the-pseudo-parallel
    statement: >-
      Křovák's scale is 0.9999 (−100 ppm) on the pseudo standard parallel, which crosses the
      area, and grows as d²/2R² away from it; every point of it lies within half a node
      diagonal (16.7 km) of a node, adding at most 3.4 ppm, so the smallest k read at the nodes is
      between −100.5 ppm (the readout's rounding) and −96 ppm.
    readout: Křovák scale k
    expect: { range: [-100.5, -96] }
  - id: mercator-scale-changes-several-percent
    statement: >-
      Web Mercator's scale is sec φ, so across the plate's latitudes, 48.5° to 51.5°, it rises from
      sec 48.5° = 1.50916 to sec 51.5° = 1.60639, by 6.4%: the readout's first end minus its second
      is −0.097227, to the four decimals each end prints.
    readout: Web Mercator scale k
    expect: { against: Web Mercator scale k, against_number: 2, offset: -0.097227, tolerance: 0.0001 }
---

How two projections bend the same graticule, measured by their distortion at each point.

Web Mercator (EPSG:3857) applies the spherical Mercator formulas, on a sphere of radius 6378137 m, to geodetic coordinates; on that sphere it is conformal with scale sec φ, so across these few degrees of latitude its scale already changes by several per cent. Křovák (EPSG:5514) maps the Bessel 1841 ellipsoid conformally onto a Gaussian sphere, rotates that sphere so the axis of its cone becomes the pole, and projects onto a cone with one standard parallel at 78°30' of the rotated latitude, scaled by 0.9999.

Both are measured the same way at every node: central differences give the scale along the meridian (h) and along the parallel (k) against the surface each projection is defined on, and the angle between the projected meridian and parallel. A conformal projection keeps h = k and that angle at 90°, which the readouts confirm to the central differences' truncation error, about 1e-10. Colour is k within each map; the smallest Křovák scale lies on the pseudo standard parallel, and EPSG:5514 turns the classical southing and westing into a north-up plane, in which the meridians lean because the cone's axis lies at 24°50' E, east of the area. Coordinates are taken as Bessel latitudes and longitudes: no datum shift from WGS 84 is applied.
