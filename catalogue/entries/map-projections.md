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
      Web Mercator's scale is sec φ, so across the default band, 48.5° to 51.5°, it rises from
      sec 48.5° = 1.50916 to sec 51.5° = 1.60639, by 6.4%: the readout's first end minus its second
      is −0.097227, to the four decimals each end prints.
    readout: Web Mercator scale k
    expect: { against: Web Mercator scale k, against_number: 2, offset: -0.097227, tolerance: 0.0001 }
  - id: mercator-smallest-scale-at-40
    statement: >-
      With the southern edge moved to 40° N the band is 40° to 43° N, and Web Mercator's smallest
      k is sec 40° = 1.305407: 1.3054 within 0.0001, half a unit of the readout's fourth decimal
      (0.00005) plus the 0.000007 it drops, with k exact along the parallel up to rounding.
    readout: Web Mercator scale k
    expect: { value: 1.3054, tolerance: 0.0001 }
    setup:
      params: { lat0: 40 }
  - id: mercator-smallest-scale-at-58
    statement: >-
      With the southern edge at 58° N, Web Mercator's smallest k is sec 58° = 1.887080: 1.8871
      within 0.0001, half a unit of the fourth decimal plus the 0.00002 the rounding adds.
    readout: Web Mercator scale k
    expect: { value: 1.8871, tolerance: 0.0001 }
    setup:
      params: { lat0: 58 }
  - id: mercator-scale-change-at-58
    statement: >-
      Across 58° to 61° N Web Mercator's scale rises from sec 58° = 1.887080 to sec 61° =
      2.062665: the readout's first end minus its second is sec 58° − sec 61° = −0.175585, within
      0.0001 for the two ends' rounding to four decimals.
    readout: Web Mercator scale k
    expect: { against: Web Mercator scale k, against_number: 2, offset: -0.175585, tolerance: 0.0001 }
    setup:
      params: { lat0: 58 }
  - id: mercator-angle-is-exactly-right-at-60
    statement: >-
      Web Mercator's x depends on longitude alone and its y on latitude alone wherever the band
      lies, so at 60° to 63° N too the meridian and parallel steps are exactly perpendicular: an
      angle error of exactly 0°.
    readout: Largest meridian–parallel angle error
    expect: { value: 0 }
    setup:
      params: { lat0: 60 }
  - id: mercator-truncation-at-a-coarse-step
    statement: >-
      With the step H = 1e-3 rad the central differences' error dominates: the series for h/k − 1
      has only positive terms, so at 51.5° N it lies between its first term, H²/6 · (tan²φ +
      sec²φ) = 6.935e-7, and that term with sec'' taken at φ + H, 6.965e-7 (Lagrange remainder);
      rounding adds about 1e-12. Printed to two digits that is 6.9e-7 or 7.0e-7.
    readout: Largest |h/k − 1|, Mercator / Křovák
    expect: { range: [6.9e-7, 7.0e-7] }
    setup:
      params: { h: '1e-3' }
  - id: mercator-truncation-at-a-finer-step
    statement: >-
      With H = 1e-4 rad the same bounds are a hundred times smaller, 6.935e-9 to 6.938e-9, and
      rounding adds under 1e-11 (about 8e-16/H, as derived for the finest step): 6.9e-9 or 7.0e-9
      to two digits.
    readout: Largest |h/k − 1|, Mercator / Křovák
    expect: { range: [6.9e-9, 7.0e-9] }
    setup:
      params: { h: '1e-4' }
  - id: mercator-rounding-at-the-finest-step
    statement: >-
      With H = 1e-6 rad truncation is only 6.9e-13 but rounding grows as 1/H: each projected y
      carries at most about 1.1e-15 R of rounding (the argument's half ulp, amplified 3.2 times by
      tan near 71°, then tan's and log's own), so h/k − 1 errs by at most about 7e-16/H from h and
      7e-17/H from k, 8e-10 in all: below 1e-9.
    readout: Largest |h/k − 1|, Mercator / Křovák
    expect: { below: 1e-9 }
    setup:
      params: { h: '1e-6' }
  - id: mercator-angle-is-exactly-right-at-a-coarse-step
    statement: >-
      Mercator's projected meridian step has no x part and its parallel step no y part at any step
      H, so with H = 1e-3 rad the angle error is still exactly 0°.
    readout: Largest meridian–parallel angle error
    expect: { value: 0 }
    setup:
      params: { h: '1e-3' }
  - id: krovak-smallest-scale-at-half-degree-nodes
    statement: >-
      With nodes every 0.5° the widest cell, at 48.5° N, is 55.6 km by 36.9 km, so every point of
      the pseudo standard parallel lies within half its diagonal, 33.4 km, of a node; the cone's
      exact scale that far off its standard parallel is 13.8 ppm above 0.9999 (d²/2R² = 13.7 ppm
      with R = 6380.7 km, plus the cubic term), and the Gaussian sphere adds at most 0.01 ppm, so
      the smallest k read is at most −86.19 ppm, −86 as printed; at least −100.5 ppm as before.
    readout: Křovák scale k
    expect: { range: [-100.5, -86] }
    setup:
      params: { step: '0.5' }
  - id: krovak-smallest-scale-at-one-degree-nodes
    statement: >-
      With nodes every 1° the half diagonal is 66.8 km and the cone's exact scale there is 55.7
      ppm above 0.9999 (d²/2R² alone gives 54.7 ppm), so the smallest k read is at most −44.30
      ppm, −44 as printed, and at least −100.5 ppm.
    readout: Křovák scale k
    expect: { range: [-100.5, -44] }
    setup:
      params: { step: '1' }
---

How two projections bend the same graticule, measured by their distortion at each point.

Web Mercator (EPSG:3857) applies the spherical Mercator formulas, on a sphere of radius 6378137 m, to geodetic coordinates; on that sphere it is conformal with scale sec φ, so across these few degrees of latitude its scale already changes by several per cent. Křovák (EPSG:5514) maps the Bessel 1841 ellipsoid conformally onto a Gaussian sphere, rotates that sphere so the axis of its cone becomes the pole, and projects onto a cone with one standard parallel at 78°30' of the rotated latitude, scaled by 0.9999.

Both are measured the same way at every node: central differences give the scale along the meridian (h) and along the parallel (k) against the surface each projection is defined on, and the angle between the projected meridian and parallel. A conformal projection keeps h = k and that angle at 90°, which the readouts confirm to the central differences' truncation error, about 1e-10 at the default step H = 1e-5 rad; the step is a control, and a coarser one shows the truncation grow as H², a finer one the rounding grow as 1/H. Colour is k within each map; the smallest Křovák scale lies on the pseudo standard parallel, and EPSG:5514 turns the classical southing and westing into a north-up plane, in which the meridians lean because the cone's axis lies at 24°50' E, east of the area. Coordinates are taken as Bessel latitudes and longitudes: no datum shift from WGS 84 is applied.

The band's southern edge is a control: the graticule always spans 3° of latitude over 12° to 19° E, and Křovák's pseudo standard parallel crosses it only near the default edge, 48.5° N.
