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
---

Iterate z ← z² + c and count how long each point takes to fly off. The Mandelbrot set and its Julia sets, coloured by a continuous escape count; click to dive in.

Every pixel is a complex number. In the Mandelbrot view it is c and the orbit starts at z = 0; in the Julia view c is fixed and the pixel is the starting z. The orbit escapes once |z| passes 256 (past both 2 and |c| it is bound to diverge); points that stay inside for the whole iteration cap are drawn in the ground colour. The main cardioid and the period-2 disc are recognised by their closed-form equations and not iterated.

The integer step count n paints hard bands. The smooth count ν = n + 1 − log₂(ln|zₙ| / ln 256) uses how far past the bailout the orbit landed, so it varies continuously where n jumps; the palette is read cyclically at a rate set by the colour density, against √ν so that deep zooms still cycle. Rows are rendered interlaced, coarse first.

The Mandelbrot set is exactly the set of c whose Julia set is connected. Presets inside it (rabbit, basilica, Siegel disc, dendrite) give one connected piece; the two dust presets lie just outside, and their Julia sets fall apart into dust with no interior. In the pointer preset, click or drag: the canvas is the c-plane of the inset map.
