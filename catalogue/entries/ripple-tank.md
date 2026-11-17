---
id: ripple-tank
title: Ripple Tank
taxonomy: physics/waves
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - wave tank
  - phased array
  - beam steering
  - Mach cone
  - vibrating membrane
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 29 (Interference: an array of oscillators, its phase and the direction of its beam), ch. 51 (Waves: the bow wave and shock wave of a source faster than its waves) and ch. 49 (Modes: the frequencies of a drum)'
    purpose: further-reading
tags:
  - waves
  - interference
  - finite differences
  - phased array
  - Mach cone
  - normal modes
complexity: O(cells) per step, explicit FD
interaction: Choose the experiment; click or drag to drop pebbles. The phased array takes a phase step between its elements, the moving source a speed in multiples of the wave speed.
motivation: One wave equation on a grid shows interference behind slits, a beam an array of sources steers by its phase alone, the cone a source faster than its waves drags behind it, and the inharmonic overtones of a drum.
relations:
  - type: related_to
    target: finite-differences
    reason: The tank's Laplacian is the five-point central second difference, second order in the cell, and its time step is the same difference in time.
  - type: related_to
    target: fft-butterfly
    reason: The drum's modes are read from a pickup's record by a discrete Fourier transform, one bin at a time, the sum the fast transform computes for every bin at once.
pedagogy:
  difficulty: intermediate
  objectives:
    - Watch Young's fringes form in the time-averaged intensity behind a double slit.
    - Steer a phased array's main lobe by the phase step between its elements alone, and match its direction to the array factor and, far away, to sin α = Δφ / (k d).
    - Measure the half-angle of the cone a source faster than its waves leaves behind and match it to sin μ = c / v.
    - Find a drum's fundamental from a pickup's spectrum and see that its overtones are not whole-number multiples of it.
  misconceptions:
    - A phased array does not point by moving; delaying each element by the same phase step tilts the wavefront it builds.
    - A Mach cone is not a wave of its own; it is the envelope of the ordinary circular waves a fast source keeps emitting.
    - A drum is not a string in two dimensions with harmonic overtones; its mode (2, 1) lies about 1.36 times above (1, 1) on this one, not twice.
  questions:
    - Why does a phase step of 45° between elements half a wavelength apart steer the beam by about 15°?
    - What happens to the Mach cone as the source slows to the wave speed?
    - Why is the drum's ratio f₂₁/f₁₁ √((4/a² + 1/b²)/(1/a² + 1/b²)), and what would it be on a square drum?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - The 2-D wave equation by leapfrog and the five-point Laplacian on unit cells, C² = 0.24, inside the stability limit of 1/2 (the shared stencil, src/plates/_shared/wave2d/leapfrog.ts).
  invariants:
    - The double slit, single slit, two sources and free surface step exactly as before the second pass (test/ripple-tank-b.test.ts proves it within one run against the module as it was).
    - Every measured angle and frequency is read from the field; the closed forms are computed beside it and never feed it.
  limitations:
    - The phased array and the moving source run on a tank of their own, 320 × 210 cells drawn across the canvas, with a sponge 40 cells deep (the tank's 18 reflected enough to move the lobe by degrees), so the readings do not depend on the canvas. The lobe is read on an arc of 83 cells, still near the array, so its oracle is the array factor at that radius; the far-field angle asin(Δφ / kd) is shown beside it and differs by a degree or two.
    - The Mach cone's front is read where |u| first exceeds 0.005, once the source is 50 cells from the far edge; that threshold puts the reading within about 1.5° of asin(c/v), and below M = 2 the cone is too wide to develop within the tank and the reading runs low.
    - The drum is 81 × 51 cells with its rim fixed and no damping; its pickup records twenty periods of the fundamental, and modes closer than a few bins (such as (1, 2) and (3, 1)) are not told apart.
experiments:
  - id: young-fringes
    title: Young's double slit
    params: { experiment: double, view: intensity }
    observe: Bright and dark fringes form behind the slits where sin θ = mλ/d.
  - id: two-sources
    title: Two point sources
    params: { experiment: two, view: intensity }
    observe: Hyperbolas of quiet water where the two waves arrive half a wavelength apart.
  - id: array-steered
    title: A phased array steered by 45° a step
    params: { experiment: array, gap: 7, phase: 45, view: intensity }
    observe: Ten sources half a wavelength apart, each 45° ahead of the one below, send one beam about 15° above the axis.
  - id: mach-two
    title: A source at twice the wave speed
    params: { experiment: moving, mach: 2 }
    observe: The circular waves crowd into a cone of half-angle 30° behind the source, sin μ = c/v.
  - id: drum
    title: A struck drum
    params: { experiment: drum }
    observe: The membrane rings in a mixture of modes; its fundamental and the inharmonic (2, 1) are read from the pickup once twenty periods are recorded.
claims:
  - id: array-lobe-follows-phase
    statement: >-
      Ten sources half a wavelength apart, each driven 45° ahead of the one below, steer the main lobe of the
      time-averaged intensity to the direction the array factor predicts at the same radius (cylindrical waves at
      the scheme's wavenumber), within 1.5°.
    readout: main lobe, measured from the intensity (degrees)
    expect: { against: 'main lobe, array factor at the same radius (degrees)', tolerance: 1.5 }
    setup:
      params: { experiment: array, gap: 7, phase: 45, lambda: 14, speed: 8, runs: 14 }
  - id: array-lobe-other-side
    statement: >-
      A phase step of −60° steers the lobe below the axis, again to the array factor's direction within 1.5°.
    readout: main lobe, measured from the intensity (degrees)
    expect: { against: 'main lobe, array factor at the same radius (degrees)', tolerance: 1.5 }
    setup:
      params: { experiment: array, gap: 7, phase: -60, lambda: 14, speed: 8, runs: 14 }
  - id: array-broadside
    statement: >-
      With no phase step the array is broadside: its main lobe points along the axis, within 0.5°.
    readout: main lobe, measured from the intensity (degrees)
    expect: { value: 0, tolerance: 0.5 }
    setup:
      params: { experiment: array, gap: 7, phase: 0, lambda: 14, speed: 8, runs: 14 }
  - id: mach-angle-two
    statement: >-
      A source moving at twice the wave speed leaves a cone of half-angle asin(c/v) = 30°, read from the
      cone's front at five distances behind it, within 2°.
    readout: Mach cone half-angle, measured (degrees)
    expect: { against: 'Mach angle asin(c / v) (degrees)', tolerance: 2 }
    setup:
      params: { experiment: moving, mach: 2, speed: 8, runs: 5 }
  - id: mach-angle-three
    statement: >-
      At three times the wave speed the cone narrows to asin(1/3) ≈ 19.5°, within 2°. The band is the
      reading's own: the front is found to a whole row at ten points (D = 30 … 90 on both sides),
      so one row of error moves the fitted slope by 1/√4500 ≈ 0.015 and μ by about 0.8°, and 2° is
      2.5 of those. Near M = 3, dμ/dM = −1/(M² cos μ) ≈ −6.8° per unit of M, so the claim fails a
      source more than about 10% off its speed: 10% slow reads 22.5°.
    readout: Mach cone half-angle, measured (degrees)
    expect: { against: 'Mach angle asin(c / v) (degrees)', tolerance: 2 }
    setup:
      params: { experiment: moving, mach: 3, speed: 8, runs: 4 }
  - id: drum-fundamental
    statement: >-
      The drum's fundamental, read from twenty periods of a pickup's record, is the grid's mode (1, 1),
      sin²(ω/2) = C²(sin²(π/2a) + sin²(π/2b)), within 1e−6 cycles a step.
    readout: drum f₁₁, measured (cycles per step)
    expect: { against: 'drum f₁₁ on the grid, sin²(ω/2) = C²(sin²(π/2a) + sin²(π/2b))', tolerance: 0.000001 }
    setup:
      params: { experiment: drum, speed: 8, runs: 36 }
  - id: drum-fundamental-membrane
    statement: >-
      The same fundamental is the continuous membrane's (c/2)√(1/a² + 1/b²) within 2e−6 cycles a step: on 80 × 50
      cells the grid's dispersion moves it by under 1e−4 of itself.
    readout: drum f₁₁, measured (cycles per step)
    expect: { against: 'drum f₁₁, membrane (c/2)√(1/a² + 1/b²)', tolerance: 0.000002 }
    setup:
      params: { experiment: drum, speed: 8, runs: 36 }
  - id: drum-inharmonic
    statement: >-
      A drum's overtones are not harmonics: f₂₁/f₁₁ measured is the membrane's √((4/a² + 1/b²)/(1/a² + 1/b²)) ≈ 1.357
      within 0.002, not 2.
    readout: drum f₂₁ / f₁₁, measured
    expect: { against: 'drum f₂₁ / f₁₁, membrane √((4/a² + 1/b²) / (1/a² + 1/b²))', tolerance: 0.002 }
    setup:
      params: { experiment: drum, speed: 8, runs: 36 }
---

The wave equation on a grid: slits, point sources, a steered array, a source faster than its waves, and a drum.

The water surface is the 2D wave equation solved by explicit finite differences (leapfrog in time, five-point Laplacian in space) with a Courant number of √0.24, inside the stability limit. An absorbing sponge at the edges keeps reflections down.

Double slit: a plane wave hits a wall with two openings; each opening becomes a new source (Huygens) and the two circular waves interfere. The intensity view averages the squared height over time, so bright fringes are where crests meet crests and dark ones where crests meet troughs.

**Phased array.** Ten sources stand in a column half a wavelength apart, each driven a fixed phase Δφ ahead of the one below. Their circular waves add up in phase only in the direction where the path difference k d sin α makes up that phase, so the array sends one beam, steered by phase alone. The plate reads the beam's direction from the time-averaged intensity on an arc about the array: the centroid of the part above half its peak. The array factor sums the elements as cylindrical waves at the scheme's own wavenumber, numericalWavenumber, at that radius. Far away it becomes sin α = Δφ/(k d), and the plate shows both.

**A source faster than its waves.** A source moving at v > c keeps emitting circular waves, each centred where the source was. Their envelope is a cone of half-angle μ with sin μ = c/v, the bow wave of a boat and the shock cone of a supersonic aircraft. The plate reads the cone's front at five distances behind the source once it has crossed most of the tank, and fits its slope.

**A drum.** A membrane of 80 × 50 cells, fixed at its rim and struck once off-centre, rings in a mixture of its modes sin(mπx/a) sin(nπy/b). On the grid each mode is an exact solution with sin²(ω/2) = C²(sin²(mπ/2a) + sin²(nπ/2b)), and on the continuous membrane f_mn = (c/2)√((m/a)² + (n/b)²). A pickup records twenty periods of the fundamental, and its Hann-windowed spectrum gives f₁₁ and f₂₁. Unlike a string's, a drum's overtones are not whole-number multiples of the fundamental.

Click or drag in the tank to drop pebbles. Shorter wavelengths give more, narrower fringes. The `runs` control stops the tank after k blocks of 100 steps, so its readouts hold still.

**Data.** The plate takes no data of a reader's: its inputs are an experiment and its sliders, and the site has no parser for a wall mask or a source layout (ADR 0010 lists the kinds that exist).
