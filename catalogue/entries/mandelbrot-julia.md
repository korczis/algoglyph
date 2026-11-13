---
id: mandelbrot-julia
title: Escape Velocity
taxonomy: numerics/fractals
status: live
engine: custom
tags:
  - fractals
  - complex numbers
  - escape time
  - dynamics
complexity: O(pixels × iterations), progressive rows
interaction: Click to zoom on a point (the Click menu zooms out instead); in Julia mode with the pointer preset, click or drag to choose c. Defaults or Reseed reset the view.
claims:
  - id: pixel-count-finds-the-area
    statement: >-
      Counting the pixels whose orbit stays bounded, at the iteration cap of 2,000 on the
      800 × 500 home view (3.6 × 2.25 of the plane), estimates the Mandelbrot set's area at
      1.5085 ± 0.0050, within three of the count's binomial standard errors of the literature value
      1.50659177 ± 8e−8; the tolerance is 3 × 0.0050. The band is loose for this count: offsetting
      the grid by a fraction of a pixel moves the estimate by about 0.0003, and a grid 4 × finer
      at the same cap reads 1.5083, so most of the 0.0019 is the cap counting slow escapers as
      inside, a bias that grows to 0.014 at the default cap of 300.
    readout: area inside (pixel count)
    expect: { value: 1.50659177, tolerance: 0.015 }
    setup:
      params: { mode: mandelbrot, view: home, iter: 2000 }
---

Iterate z ← z² + c and count how long each point takes to fly off. The Mandelbrot set and its Julia sets, coloured by a continuous escape count; click to dive in.

Every pixel is a complex number. In the Mandelbrot view it is c and the orbit starts at z = 0; in the Julia view c is fixed and the pixel is the starting z. The orbit escapes once |z| passes 256 (past both 2 and |c| it is bound to diverge); points that stay inside for the whole iteration cap are drawn in the ground colour. The main cardioid and the period-2 disc are recognised by their closed-form equations and not iterated.

The integer step count n paints hard bands. The smooth count ν = n + 1 − log₂(ln|zₙ| / ln 256) uses how far past the bailout the orbit landed, so it varies continuously where n jumps; the palette is read cyclically at a rate set by the colour density, against √ν so that deep zooms still cycle. Rows are rendered interlaced, coarse first.

The Mandelbrot set is exactly the set of c whose Julia set is connected. Presets inside it (rabbit, basilica, Siegel disc, dendrite) give one connected piece; the two dust presets lie just outside, and their Julia sets fall apart into dust with no interior. In the pointer preset, click or drag: the canvas is the c-plane of the inset map.

The last readout turns the picture into a measurement: the fraction of pixels that stayed bounded, times the area of the view, is an estimate of the area of the set (or, in Julia mode, of the filled Julia set) inside the view, given with the binomial standard error of the count. Both caps on it show: the pixel size limits how finely the boundary is sampled, and the iteration cap counts points that escape slowly as inside, so the estimate falls towards the true area as the cap rises. The two errors behave differently, and the home view shows it. The standard error is sampling error: it shrinks as pixels are added, and at the home view it is 0.0050. The cap's bias is truncation error: more pixels do not touch it. At the default cap of 300 the estimate sits 0.014 above the area 1.50659 of the literature, 2.9 standard errors, so the sampling band nearly hides a bias that a finer grid would never remove. At a cap of 2,000 it reads 1.5085, 0.38 standard errors off, and a grid four times finer at that cap reads 1.5083: what is left is mostly the cap, not the pixels.
