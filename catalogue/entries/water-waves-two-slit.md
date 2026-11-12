---
id: water-waves-two-slit
title: Water Waves Through Two Openings
taxonomy: physics/waves
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. III, ch. 1, §1-3 (an experiment with waves); the same chapter as Vol. I, ch. 37'
    purpose: further-reading
tags:
  - waves
  - interference
  - finite differences
  - numerical dispersion
  - wave equation
complexity: O(cells) per time step, three tanks at once; explicit leapfrog
interaction: Every knob is a parameter of the solver and restarts the tanks; the pace sets steps per frame.
motivation: The bridge between bullets and electrons, waves interfere like the electrons and arrive smoothly, unlike either.
relations:
  - type: compares_with
    target: two-slit-classical
    reason: The same experiment with bullets, whose curves add; water waves are the bridge between bullets and electrons.
  - type: compares_with
    target: two-slit-amplitudes
    reason: The electrons' arrivals follow the same interference curve these waves draw, but one lump at a time.
  - type: related_to
    target: ripple-tank
    reason: The same wave equation by the same leapfrog scheme, played freely with pebbles rather than measured.
  - type: related_to
    target: quantum-tunnelling
    reason: Another wave equation integrated on a grid, there the Schrödinger equation by split steps.
pedagogy:
  difficulty: intermediate
  objectives:
    - Read interference on a detector line as the coherent sum of two waves, and compare it with the two intensities measured alone.
    - Predict where the bright fringes fall from the path difference, and see why λL/d is only the far-field limit.
    - See a numerical scheme's own dispersion make its waves slightly shorter than the continuum's, and measure it.
    - Shift the pattern with a phase, flatten it with unequal amplitudes, and check both against the formula.
    - Watch the scheme refuse an unstable Courant number, and its energy stay put without damping.
  misconceptions:
    - The fringe spacing λL/d is not exact at any finite distance; nearer than L ≫ d²/λ the paths' geometry stretches the spacing.
    - Intensities do not add for waves; with both openings the centre holds about twice I₁ + I₂, not their sum.
    - A finite-difference wave is not the continuum wave; its wavelength depends on the grid and on the direction it travels.
  questions:
    - Why is the measured spacing larger than λL/d here, and by how much would it shrink if the line moved twice as far away?
    - What visibility do sources of amplitudes 1 and ½ give, and why does it not depend on where the line is, near the axis?
    - Which way does the pattern move when source 2 leads by a quarter cycle, and by how far?
    - What goes wrong if the time step is raised past the Courant limit, and why does the tank refuse rather than try?
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
  preconditions:
    - The Courant number C = cΔt/Δx is in (0, 1/√2]; outside it the field is refused, not stepped.
  invariants:
    - With no damping and no sponge, inside fixed edges, the scheme's discrete energy is conserved to rounding.
    - The scheme is linear, so the tank with both sources is exactly the sum of the tanks with one each.
  limitations:
    - The absorbing border is a quadratic sponge; it reflects a little, which ripples a single source's amplitude along the detector line by about 2 % (shown as a readout) and pulls maxima by a fraction of a cell.
    - In the slit tank each opening is treated as a point source at its exit for the prediction; its width is a few cells, so the prediction is approximate there.
    - The far-field spacing λL/d is a limit; this tank is not far enough for it, and the readouts say by how much.
    - The intensity is the time average of u² at the drive frequency, from a lock-in over sixteen periods once the tank is steady; it is not a running average.
experiments:
  - id: unequal-sources
    title: Unequal sources
    params: { ratio: 0.5 }
    observe: The dark fringes no longer reach zero; the visibility is 2r/(1 + r²) = 0.8.
  - id: quarter-cycle-lead
    title: Source 2 leads by a quarter cycle
    params: { phase: 90 }
    observe: The central bright fringe moves about a quarter of a fringe towards source 1.
  - id: through-two-slits
    title: A plane wave through two slits
    params: { scenario: slits }
    observe: The openings act as two sources in phase; with both open the centre holds about twice I₁ + I₂.
  - id: unstable
    title: Past the Courant limit
    params: { courant: 0.75 }
    observe: The tank refuses to step and says why.
claims:
  - id: the-grid-keeps-its-dispersion
    statement: >-
      A numerics check: the wavelength measured from the phase along source 1's axis agrees with the
      one the scheme's dispersion relation, sin²(ω/2) = C² sin²(k/2), gives along that axis, within
      0.01 cells; it is 1.3 % shorter than the continuum λ₀ = 2πc/ω.
    readout: wavelength along the axis, measured from the phase
    expect: { against: 'wavelength along the axis, from the scheme’s dispersion', tolerance: 0.01 }
  - id: spacing-follows-paths-and-grid
    statement: >-
      The mean spacing of the bright fringes measured within 55 cells of the axis agrees with the
      spacing predicted from the exact path lengths and the grid's own wavenumber in each direction,
      within 1 cell: a quarter cell of reading each maximum, and the sponge's ripple.
    readout: fringe spacing, measured
    expect: { against: 'fringe spacing, the grid’s dispersion and the exact paths', tolerance: 1 }
  - id: far-field-misses-by-the-derived-correction
    statement: >-
      The measured spacing departs from the far-field λ₀L/d by the correction that the exact paths
      and the grid's dispersion predict: the departure, in units of that correction plus a quarter
      cell, lies between 0.8 and 1.2.
    readout: spacing gap from λ₀L/d, in its derived error
    expect: { range: [0.8, 1.2] }
  - id: maxima-where-predicted
    statement: >-
      Every bright fringe within 55 cells of the axis lies within 1 cell of where the predicted
      intensity, a/√r from each source with its path's phase, has its maximum.
    readout: largest gap, measured maxima against predicted
    expect: { below: 1 }
  - id: unequal-amplitudes-visibility
    statement: >-
      With source 2 at half the amplitude of source 1, the central fringe's visibility agrees with
      2√(I₁I₂)/(I₁ + I₂) computed from the two intensities measured with each source alone, within
      0.01.
    readout: visibility at the central fringe, measured
    expect: { against: 'visibility from I₁ and I₂ measured alone, 2√(I₁I₂)/(I₁ + I₂)', tolerance: 0.01 }
    setup:
      params: { ratio: 0.5 }
  - id: unequal-amplitudes-closed-form
    statement: >-
      That visibility is also the closed form for amplitudes 1 and r near the axis, 2r/(1 + r²) = 0.8,
      within 0.01.
    readout: visibility at the central fringe, measured
    expect: { value: 0.8, tolerance: 0.01 }
    setup:
      params: { ratio: 0.5 }
  - id: phase-moves-the-pattern
    statement: >-
      With source 2 leading by 90°, the central bright fringe moves to where the predicted intensity
      puts it, about a quarter fringe towards source 1, within 0.6 cells.
    readout: central maximum, measured
    expect: { against: 'central maximum, predicted', tolerance: 0.6 }
    setup:
      params: { phase: 90 }
  - id: phase-moves-it-by-a-quarter
    statement: >-
      The move is a real one, more than 8 cells off the axis, about a quarter of the 50-cell fringe.
    readout: central maximum, measured
    expect: { below: -8 }
    setup:
      params: { phase: 90 }
  - id: refuses-an-unstable-step
    statement: >-
      Asked for a Courant number of 0.75, above the 2-D limit 1/√2, the tank refuses and takes no
      step at all rather than one that would grow without bound.
    readout: time steps taken
    expect: { value: 0 }
    setup:
      params: { courant: 0.75 }
  - id: energy-conserved-without-damping
    statement: >-
      A numerics check: a pulse in a closed box with no damping keeps the scheme's discrete energy,
      ½Σ(u − u⁻)² + ½C²Σ(Δu)(Δu⁻), to within 1e−12 of where it started after 2,000 steps.
    readout: energy drift from the start, numerics
    expect: { below: 0.000000000001 }
    setup:
      params: { scenario: pulse, damping: 0 }
  - id: energy-decays-with-damping
    statement: >-
      With damping γ = 0.005 a step, the energy falls at the rate γ: the measured −ln(E/E₀) per step
      agrees with γ within 5 %, as it should once kinetic and potential energy share it equally on
      average.
    readout: energy decay rate, measured (per 1000 steps)
    expect: { against: 'damping γ (per 1000 steps)', tolerance: 0.25 }
    setup:
      params: { scenario: pulse, damping: 5 }
  - id: slits-centre-is-not-the-sum
    statement: >-
      Through two slits, the centre of the detector line with both open holds twice the sum of the
      intensities with one open each, within 0.1: the waves' amplitudes add, then square.
    readout: centre, both open over I₁ + I₂
    expect: { range: [1.9, 2.1] }
    setup:
      params: { scenario: slits }
  - id: slits-spacing-follows-the-openings
    statement: >-
      Through two slits, the fringe spacing agrees within 1 cell with the prediction that treats each
      opening as a point source in phase at its exit, with the grid's wavenumber.
    readout: fringe spacing, measured
    expect: { against: 'fringe spacing, the grid’s dispersion and the exact paths', tolerance: 1 }
    setup:
      params: { scenario: slits }
---

Two coherent sources, or a plane wave through two openings, on a tank of water solved as a wave equation; a detector line across the tank measures the intensity and finds the fringes where the path difference says they should be.

**The tank.** The surface obeys u_tt + γu_t = c²∇²u, solved on a fixed grid by the explicit leapfrog scheme with the five-point Laplacian. The scheme is stable only while the Courant number C = cΔt/Δx is at most 1/√2 in two dimensions; ask for more and the tank refuses to take a step. Sources are soft, a forcing added at a cell, so the tank is linear: three tanks run side by side, both sources, source 1 alone and source 2 alone, and the first is exactly the sum of the other two. A sponge, damping that grows into the border, absorbs what leaves.

**What is measured.** Once the tanks are steady (after the waves have crossed the tank twice), a lock-in at the drive frequency averages the surface along the detector line over sixteen periods: the time-averaged u² in each cell. The bright and dark fringes are its local extremes, placed between cells by a parabola. The wavelength along source 1's axis is read from the slope of the lock-in's phase.

**What it is compared with.** The far-field spacing λL/d (#/p/two-slit-amplitudes uses the same formula) is a limit this tank does not reach: 140 cells from sources 30 apart is not far enough, and the fringes are stretched by about a tenth. The prediction the measurements are held to uses the exact path lengths and, for each path, the wavenumber the scheme itself carries in that direction, from its dispersion relation sin²(ω/2) = C²[sin²(k cos θ/2) + sin²(k sin θ/2)]; the grid makes the waves about 1 % shorter than the continuum's at ten cells a wavelength. The visibility of the central fringe is compared with 2√(I₁I₂)/(I₁ + I₂) from the two intensities measured alone, and with 2r/(1 + r²) for amplitudes 1 and r; the phase of source 2 moves the pattern by its fraction of a cycle.

**The energy.** In the closed-box mode a pulse rings in a box with fixed edges and no sponge: the scheme's own discrete energy, ½Σ(u − u⁻)² + ½C²Σ(Δu)(Δu⁻), stays constant to rounding without damping, and with damping γ it falls at the rate γ.

**The bridge.** Water waves arrive smoothly, with any intensity at all; their interference is the amplitudes adding before they are squared. #/p/two-slit-classical shows bullets, lumpy and adding; #/p/two-slit-amplitudes shows electrons, lumpy and interfering. The default run is calm: at the pace of config/pacing.yaml the tank takes about forty seconds to reach its measurement, and the claims run faster at their own pace.
