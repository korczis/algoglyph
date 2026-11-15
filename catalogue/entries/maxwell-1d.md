---
id: maxwell-1d
title: Maxwell's Equations on a Line
taxonomy: physics/optics
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. II, ch. 18 (Maxwell''s equations), ch. 20 (solutions in free space), ch. 32 and 33 (refraction, reflection, and the index of matter)'
    purpose: further-reading
  - id: yee-1966
    purpose: implementation
tags:
  - Maxwell's equations
  - FDTD
  - reflection
  - skin depth
  - refractive index
  - energy conservation
complexity: O(cells × steps); the dielectric run is two grids of 35 wavelengths for about 200 periods
interaction: Choose the experiment, the slab's permittivity, the conductor's conductivity, the resolution, or the light's frequency in the medium.
motivation: Light meeting glass, a metal and a cloud of electrons, computed from Maxwell's two curl equations alone; the Fresnel coefficient, the skin depth and the index all come out without being put in.
relations:
  - type: derived_from
    target: bound-electron-medium
    reason: The medium here is that plate's electrons on springs, now driven by a field that travels and is changed by them; the index the wave shows is the one that plate measured.
  - type: related_to
    target: ripple-tank
    reason: The same wave equation in another dress; there a scalar wave on a 2-D grid, here E and H leapfrogged on a line.
pedagogy:
  difficulty: advanced
  objectives:
    - Watch a pulse split at a dielectric face and measure the reflected share against ((n − 1)/(n + 1))².
    - Check that the reflected and the transmitted energy add to the incident, as the fields themselves must.
    - Measure how fast a wave dies in a conductor and compare with the skin depth.
    - Read a medium's index from the phase of a wave inside it, above and below its electrons' resonance.
  misconceptions:
    - A reflection is not produced at the surface alone; it is the sum of the waves every layer of electrons sends back.
    - In a conductor the wave does not stop at the surface; it decays over a skin depth, which shrinks as √(1/σω).
    - An index below one does not make a signal faster than light; the measured speed here is a phase speed.
  questions:
    - Why does a slab reflect more in all than its front face alone?
    - How does the skin depth change when the frequency is quadrupled?
    - Where between the resonance and the plasma frequency does the index pass through one?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - The Courant number cΔt/Δx is 1 for vacuum, dielectric and conductor, and 0.5 with bound electrons, whose explicit polarisation update needs it.
  invariants:
    - In a lossless slab the energy reflected and transmitted equals the energy incident, to round-off of the flux sums.
  limitations:
    - One dimension, so plane waves at normal incidence only.
    - The grid's dispersion makes waves in a dielectric slightly slow, an error second order in the cells per wavelength; at 80 cells per wavelength the front-face reflectance is about 0.7 % high.
    - Mur's absorbing ends are exact only for vacuum at Courant number 1; the medium's end is absorbed by raising its damping instead.
experiments:
  - id: coarse
    title: A coarse grid
    params: { cells: 20 }
    observe: The reflectance comes out several percent high; the slab's waves are slowed by the grid's own dispersion.
  - id: diamond
    title: Diamond
    params: { eps: 5.8 }
    observe: About 17 % of the light reflects at each face, which is why a cut diamond sparkles.
  - id: good-conductor
    title: A good conductor
    params: { mode: conductor, sigma: 1 }
    observe: The wave dies within a few cells; the skin depth approaches √(2/σω).
  - id: below-resonance
    title: Below the resonance
    params: { mode: medium, w: 0.2 }
    observe: The waves inside are shorter than outside; the index is above one.
claims:
  - id: fresnel
    statement: >-
      A pulse at 80 cells per wavelength meets glass of ε = 4: its front face reflects ((n − 1)/(n + 1))² = 1/9 of
      the energy within 1 % (0.0011); the grid's dispersion, second order in the cells per wavelength, is the gap.
    readout: reflectance of the front face, its echo’s energy over the pulse’s
    expect: { against: 'reflectance ((n − 1)/(n + 1))² at normal incidence, n = √ε', tolerance: 0.0011 }
  - id: energy-conserved
    statement: >-
      Everything the slab reflects, at all its faces, plus everything it transmits is the incident energy within
      1e−6: Maxwell's equations on the grid lose nothing.
    readout: reflected plus transmitted (energy conserved)
    expect: { value: 1, tolerance: 0.000001 }
  - id: skin-depth
    statement: >-
      In a conductor of σ = 0.05 the amplitude decays at Im k = ω√(½(√(1 + (σ/ω)²) − 1)) within 1 %, the
      continuum's rate, measured over the first cells inside.
    readout: decay rate of the amplitude inside, measured over the first cells (per cell)
    expect: { against: 'decay rate Im k = ω√(½(√(1 + (σ/ω)²) − 1)), the continuum', tolerance: 0.0002 }
    setup:
      params: { mode: conductor }
  - id: medium-index
    statement: >-
      Above the electrons' resonance, at ω = 0.45, the wave inside has the index of the bound-electron model,
      Re √(1 + χ) ≈ 0.746, within 1 %: below one, its phase runs faster than light.
    readout: index inside, measured from the phase across two wavelengths
    expect: { against: 'index n = Re √(1 + χ) of the bound-electron model', tolerance: 0.0075 }
    setup:
      params: { mode: medium }
  - id: medium-index-below
    statement: >-
      Below the resonance, at ω = 0.2, the index is the model's ≈ 1.414 within 1 %.
    readout: index inside, measured from the phase across two wavelengths
    expect: { against: 'index n = Re √(1 + χ) of the bound-electron model', tolerance: 0.014 }
    setup:
      params: { mode: medium, w: 0.2 }
---

Maxwell's equations for a plane wave, E along z and H along y, solved on a line of cells: a pulse meeting a slab of glass, a wave entering a conductor, and a wave in a medium of bound electrons.

**Yee's grid.** E lives on whole cells and H on the half cells between them, and the two curl equations, ∂H/∂t = ∂E/∂x and ε∂E/∂t = ∂H/∂x − σE, are leapfrogged half a step apart: each field is updated from the other's difference across a cell. In vacuum at a Courant number of one this carries a wave without any error at all, and Mur's condition at the ends lets it leave. A dielectric divides the E update by ε; a conductor adds the loss σE, centred in time; bound electrons add a polarisation P obeying the driven oscillator's equation, P'' + γP' + ω₀²P = fω_p²E, advanced alongside, with E = D − P.

**Reflection and conservation.** The plate runs the pulse twice, once in empty space and once with the slab, and the difference at a probe before the slab is the light the slab sends back. The energy of the first echo, ∫E H dt, over the pulse's energy, is the front face's reflectance, which Fresnel's ((n − 1)/(n + 1))² predicts. The echoes from the back face follow, and with everything the slab transmits they add up to the incident energy: the grid conserves it.

**The skin depth.** In a conductor the wave's amplitude decays as e^(−αx) with α = Im √(ω² − iωσ), which for a good conductor becomes 1/√(2/σω), the skin depth. The plate drives a steady wave in, locks in on the amplitude cell by cell, and fits the decay.

**The index of a medium.** With the electrons of #/p/bound-electron-medium in the right part of the line, a steady wave's phase changes by nω per cell, and the plate reads n from the phase across two wavelengths: above one below the resonance, below one above it. The same wave equation drives the 2-D water of #/p/ripple-tank.
