---
id: polarization-bench
title: A Polarisation Bench and Fresnel's Interface
taxonomy: physics/optics
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 33 (polarization); Vol. II, ch. 33 (reflection from surfaces); Vol. III, ch. 11 (the polarization states of the photon)'
    purpose: further-reading
  - id: jackson-1999
    ref: 'Section 7.3, reflection and refraction at a plane interface'
    purpose: further-reading
tags:
  - polarisation
  - Jones calculus
  - Malus's law
  - Fresnel equations
  - Brewster's angle
  - Born rule
complexity: O(elements) per photon; the interface's curves O(angles) per frame
interaction: Choose the light, the polariser, what sits between and the analyser, or the two indices and the angle at an interface; photons are sent one by one. Attach your own Malus curve to fit it.
motivation: Light has a direction across its path, and a sheet of polaroid sorts it; the same sorting done one photon at a time is the simplest quantum measurement there is, and at a glass surface it decides how much light is reflected and why sunglasses work.
relations:
  - type: compares_with
    target: maxwell-1d
    reason: Fresnel's reflectance at normal incidence two ways, here from the boundary conditions in closed form, there measured from a pulse on Yee's grid.
  - type: related_to
    target: spin-precession
    reason: The Poincaré sphere of polarisation is the Bloch sphere of a two-state system; a wave plate turns the one as a field turns the other.
  - type: uses
    target: least-squares
    reason: A reader's Malus curve is fitted by linear least squares in 1, cos 2θ and sin 2θ.
pedagogy:
  difficulty: intermediate
  objectives:
    - Follow a polarisation state through polarisers and wave plates with Jones matrices, and check Malus's cos² law.
    - See that a third polariser between two crossed ones lets light through, and a half-wave plate mirrors the polarisation about its axis.
    - Send photons one by one through the bench by Born's rule and watch their counts approach the intensity.
    - Compute Fresnel's reflection and transmission at an interface, find Brewster's angle and the critical angle, and check R + T = 1.
  misconceptions:
    - A polariser does not filter out a fixed share of photons by their type; each photon passes with a probability, and the one that passes leaves polarised along the axis.
    - Crossed polarisers do not stay dark when a third is put between them; the middle one makes a new state with a component along the last.
    - Beyond the critical angle no light is lost; it is all reflected, with a phase that depends on the polarisation.
  questions:
    - Why does a half-wave plate turned by θ turn the polarisation by 2θ?
    - What fraction of unpolarised light passes three polarisers at 0°, 45° and 90°, and why is it not zero?
    - At Brewster's angle the reflected light is wholly s-polarised. Why does that make polarising sunglasses cut glare from water?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - Ideal elements; a polariser passes its axis completely and blocks the other wholly.
  limitations:
    - Monochromatic plane waves; no absorption in the media, so the indices are real.
    - Unpolarised light is an equal mixture of horizontal and vertical photons, which gives every intensity an incoherent mixture gives.
experiments:
  - id: crossed
    title: Crossed polarisers
    params: { theta1: 0, theta3: 90 }
    observe: Nothing passes, photon after photon.
  - id: third-between
    title: A third polariser between them
    params: { theta1: 0, middle: polariser, theta2: 45, theta3: 90 }
    observe: A quarter of the light gets through, and an eighth of unpolarised light.
  - id: quarter-wave
    title: Circular light from a quarter-wave plate
    params: { theta1: 0, middle: quarter, theta2: 45, theta3: 30 }
    observe: The light after the plate is circular, S₃/S₀ = ±1, and half of it passes any analyser.
  - id: brewster
    title: Brewster's angle
    params: { view: interface, incidence: 56, pol: p }
    observe: Almost no p-polarised light is reflected; s-polarised light still is.
  - id: total-reflection
    title: Total internal reflection
    params: { view: interface, n1: 1.5, n2: 1, incidence: 60 }
    observe: Everything is reflected; nothing crosses.
claims:
  - id: malus-law
    statement: >-
      Horizontal light through a polariser at 30° and an analyser at 90° passes cos²30° · cos²60° by Jones
      matrices, Malus's law twice in closed form, within the printed 10⁻⁶.
    readout: transmitted intensity, Jones
    expect: { against: 'Malus, cos²(θ₃ − θ₁) after the first polariser', tolerance: 1.0e-6 }
    setup:
      params: { view: bench, input: h, theta1: 30, middle: none, theta3: 90 }
  - id: third-polariser
    statement: >-
      A polariser at 45° between crossed ones at 0° and 90° passes a quarter of horizontal light, the
      Jones product against Malus applied twice, within 10⁻⁶.
    readout: transmitted intensity, Jones
    expect: { against: 'Malus twice, cos²(θ₂ − θ₁) cos²(θ₃ − θ₂)', tolerance: 1.0e-6 }
    setup:
      params: { view: bench, input: h, theta1: 0, middle: polariser, theta2: 45, theta3: 90 }
  - id: half-wave-mirror
    statement: >-
      A half-wave plate at 40° turns light polarised at 10° to 70°, so an analyser at 70° passes all
      that the first polariser passed: the Jones product against cos²(θ₃ − 2θ₂ + θ₁) within 10⁻⁶.
    readout: transmitted intensity, Jones
    expect: { against: 'the half-wave plate mirrors θ₁ to 2θ₂ − θ₁: cos²(θ₃ − 2θ₂ + θ₁)', tolerance: 1.0e-6 }
    setup:
      params: { view: bench, input: h, theta1: 10, middle: half, theta2: 40, theta3: 70 }
  - id: photons-by-born
    statement: >-
      Twenty thousand photons sent one by one through three polarisers by Born's rule pass in the
      fraction the Jones intensity predicts, within four standard deviations of the readout over the
      calibration seeds 101–130, 4 × 1.02 binomial standard errors, at every seed of 1–5.
    readout: photon fraction minus the prediction, in standard errors
    expect: { range: [-4.1, 4.1] }
    setup:
      params: { view: bench, input: h, theta1: 0, middle: polariser, theta2: 45, theta3: 90, photons: 20000 }
      seeds: [1, 2, 3, 4, 5]
  - id: energy-at-the-interface
    statement: >-
      At 56° from air into glass of index 1.5 the s-polarised reflectance and transmittance, with the
      cos and n factors of the power, add to 1 within the printed 10⁻⁶.
    readout: Rs + Ts
    expect: { value: 1, tolerance: 1.0e-6 }
    setup:
      params: { view: interface, n1: 1, n2: 1.5, incidence: 56 }
  - id: energy-at-the-interface-p
    statement: >-
      The p-polarised reflectance and transmittance at the same interface add to 1 within 10⁻⁶.
    readout: Rp + Tp
    expect: { value: 1, tolerance: 1.0e-6 }
    setup:
      params: { view: interface, n1: 1, n2: 1.5, incidence: 56 }
  - id: normal-incidence
    statement: >-
      At normal incidence on glass of index 1.5 the reflectance is ((n₁ − n₂)/(n₁ + n₂))² = 0.04
      within 10⁻⁶.
    readout: Rs, Ts
    expect: { against: 'normal incidence ((n₁ − n₂)/(n₁ + n₂))²', tolerance: 1.0e-6 }
    setup:
      params: { view: interface, n1: 1, n2: 1.5, incidence: 0 }
  - id: brewster-angle
    statement: >-
      The angle where r_p changes sign, found by bisection on Fresnel's amplitude, is atan(n₂/n₁),
      56.31° for air and glass, within 10⁻⁶ of a degree.
    readout: Brewster’s angle, where r_p changes sign, by bisection, °
    expect: { against: 'atan(n₂/n₁), °', tolerance: 1.0e-6 }
    setup:
      params: { view: interface, n1: 1, n2: 1.5 }
  - id: total-internal-reflection
    statement: >-
      From glass of index 1.5 into air at 60°, beyond the critical angle of 41.8°, all the s-polarised
      light is reflected, Rs = 1 within 10⁻⁶.
    readout: Rs, Ts
    expect: { value: 1, tolerance: 1.0e-6 }
    setup:
      params: { view: interface, n1: 1.5, n2: 1, incidence: 60 }
  - id: wave-plates-are-lossless
    statement: >-
      Numerics: the wave plate's Jones matrix is unitary, |J†J − I| below 10⁻¹⁴.
    readout: largest |J†J − I| of the wave plates (numerics)
    expect: { below: 1.0e-14 }
    setup:
      params: { view: bench, middle: quarter }
data:
  - id: malus
    title: Your Malus curve
    kind: table
    accepts: [csv, json]
    columns:
      - { key: angle, unit: 'degrees, the analyser', min: -360, max: 720 }
      - { key: intensity, unit: 'intensity (any unit)', min: 0, max: 1000000000 }
    rows: { min: 3, max: 720 }
    bytes: 32768
    replaces: view
    ignores: [input, theta1, middle, theta2, theta3, n1, n2, incidence, pol, photons]
    url_bytes: 1800
    note: Each row is an analyser angle and the intensity measured there; the plate fits A cos²(θ − θ₀) + B by least squares and reports the amplitude, the axis, the floor and the extinction.
---

Light through polarisers and wave plates, described by Jones vectors and matrices and sent through one photon at a time; and light at a plane interface, reflected and refracted as Fresnel's equations say.

**The bench.** A polarisation state is a pair of complex amplitudes, (Eₓ, E_y). A polariser with its axis at θ projects the state onto (cos θ, sin θ); a wave plate delays one axis behind the other, by a quarter or a half of a wavelength, which in Jones's calculus is a rotation, a diagonal phase and the rotation back. The bench multiplies the matrices of its elements in order, and the transmitted intensity is |E|². Beside it the plate prints the closed forms: Malus's cos² law through two polarisers, the law twice through three, and the half-wave plate's mirror image of the polarisation about its axis, θ to 2θ₂ − θ. The Stokes parameters of the light that leaves tell whether it is linear (S₃ = 0), circular (S₃ = ±S₀), or in between.

**Photons.** The same bench, photon by photon: at each polariser a photon in state ψ passes with probability |⟨u|ψ⟩|² and leaves in the state |u⟩ of the axis, or is absorbed; a wave plate turns its state without loss. Nothing in this rule mentions the intensity, yet the fraction that passes approaches it, within a binomial standard error that shrinks as 1/√N. Unpolarised light is sent as horizontal or vertical photons at random.

**The interface.** At a plane boundary between indices n₁ and n₂, the fields along the surface must match, which fixes Fresnel's amplitudes: r_s, t_s for light polarised across the plane of incidence and r_p, t_p for light polarised in it. The reflectance is |r|², and the transmittance carries the factor n₂ cos θt/(n₁ cos θi), because the transmitted beam is narrower or wider and its energy flows at a different speed; with it, R + T = 1. The plate finds Brewster's angle as the place where r_p changes sign, by bisection on the amplitude itself, and compares it with atan(n₂/n₁). Going from the denser medium beyond the critical angle asin(n₂/n₁), cos θt becomes imaginary, |r| = 1, and the reflected light gains a phase that differs between s and p. Normal incidence is also measured on Yee's grid in #/p/maxwell-1d.

**Your Malus curve.** A table of analyser angles and measured intensities is fitted by least squares to A cos²(θ − θ₀) + B, linear in 1, cos 2θ and sin 2θ, giving the amplitude, the polariser's axis, the floor that imperfect polarisers leave and the extinction ratio. The table stays in the browser.
