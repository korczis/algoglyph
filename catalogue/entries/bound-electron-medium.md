---
id: bound-electron-medium
title: Light in a Medium of Bound Electrons
taxonomy: physics/optics
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 31 (the origin of the refractive index) and ch. 32 (radiation damping, scattering); Vol. II, ch. 11 (dielectrics) and ch. 32 (the index of dense materials)'
    purpose: further-reading
  - id: jackson-1999
    ref: 'Chapter 7: the Lorentz model of dispersion, the plasma frequency, the Kramers–Kronig relations and the sum rule'
    purpose: implementation
tags:
  - refractive index
  - dispersion
  - absorption
  - Kramers–Kronig
  - plasma frequency
  - Rayleigh scattering
complexity: O(steps) per frequency, a lock-in of 20 drive periods after 28/γ of settling; 512 frequencies and an FFT of 1024
interaction: Choose the medium, its damping and density, and the light's frequency; the dense toggle adds the neighbours' field.
motivation: Why light is slower in glass, why glass is clear but absorbs in the ultraviolet, why the sky is blue and a metal shines all come from one picture, electrons on springs driven by the light's field.
relations:
  - type: derived_from
    target: driven-oscillator
    reason: Every electron here is that plate's driven damped oscillator, measured by the same lock-in; the medium is their polarisation added up.
  - type: uses
    target: hilbert-analytic
    reason: Kramers–Kronig is a Hilbert transform in frequency; the analytic-signal FFT method there recovers Re χ from the measured Im χ.
  - type: uses
    target: least-squares
    reason: Rayleigh's ω⁴ is the least-squares slope of the radiated power against frequency on log axes.
pedagogy:
  difficulty: advanced
  objectives:
    - Measure a medium's susceptibility by driving its electrons and reading their response, and check it against the Lorentz sum.
    - Read off where a medium is transparent, where it absorbs and where its index changes fastest.
    - Recover the real part of χ from its imaginary part alone, by causality.
    - See a metal's index become imaginary below the plasma frequency, so that it reflects.
    - Find the ω⁴ of Rayleigh scattering far below a resonance.
  misconceptions:
    - An index below one does not let a signal travel faster than light; it is the phase that runs ahead, not the energy.
    - Absorption is not spread over all colours; it sits in bands around the resonances, and a transparent window lies between them.
    - Packing the electrons closer does not just add more of the same response; their fields on each other move the resonance down.
  questions:
    - Why does the index rise towards a resonance from below and fall below one just above it?
    - What does the f-sum tell you about a medium you have only measured up to some frequency?
    - Why is the sky blue but sunsets red, by this plate's slope?
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
  preconditions:
    - The damping is at least 0.02 ω₀, so a resonance spans more than two steps of the sweep.
  limitations:
    - Electrons are classical oscillators; quantum mechanics enters only through the oscillator strengths f, which are set, not computed.
    - The light is a single frequency with no field of its own here; propagation through a slab is drawn from the index, not integrated.
    - Kramers–Kronig sees only the measured band up to 8 ω₀; the missing tail and the grid's resolution of the peak limit it to about 0.2 % of the peak.
experiments:
  - id: below
    title: Below the resonance
    params: { probe: 0.5 }
    observe: The index is above one and rising; almost nothing is absorbed.
  - id: above
    title: Just above it
    params: { probe: 1.2 }
    observe: The index is below one; the phase velocity exceeds c while the wave is absorbed.
  - id: dense
    title: Dense matter
    params: { dense: true, wp2: 1.5 }
    observe: The absorption moves down to √(ω₀² − fω_p²/3).
  - id: glass
    title: Glass
    params: { mode: glass }
    observe: Between the infrared and the ultraviolet resonance the index rises gently with frequency, blue bent more than red.
  - id: metal
    title: A metal below its plasma frequency
    params: { mode: plasma, wp2: 2, probe: 0.6 }
    observe: The wave dies within a fraction of a wavelength; nearly all of it is reflected.
claims:
  - id: measured-is-lorentz
    statement: >-
      The electrons, driven at 0.8 ω₀ and locked in over twenty periods, give Re χ equal to the Lorentz sum
      fω_p²(ω₀² − ω²)/((ω₀² − ω²)² + γ²ω²) within 1e−5.
    readout: Re χ at the probe, the electrons driven and locked in
    expect: { against: 'Re χ at the probe, the Lorentz sum Σfω_p²/(ω_j² − ω² − iγω)', tolerance: 0.00001 }
  - id: measured-absorption
    statement: >-
      At the resonance itself their absorption Im χ = fω_p²/γω₀ = 5 matches the sum within 1e−5.
    readout: Im χ at the probe (absorption), locked in
    expect: { against: 'Im χ at the probe, the Lorentz sum', tolerance: 0.00001 }
    setup:
      params: { probe: 1 }
  - id: kramers-kronig
    statement: >-
      Re χ at 0.8 ω₀, recovered by Kramers–Kronig from the measured absorption alone, agrees with the
      measured Re χ within 0.01, the limit of a band ending at 8 ω₀ sampled 512 times (0.2 % of the peak).
    readout: Re χ at the probe by Kramers–Kronig from the measured Im χ
    expect: { against: 'Re χ at the probe, measured on the grid', tolerance: 0.01 }
  - id: f-sum
    statement: >-
      The measured absorption obeys the sum rule ∫ω Im χ dω = (π/2)ω_p² Σf within 1e−3: the total
      absorption counts the electrons, whatever their resonances.
    readout: f-sum ∫ω Im χ dω, measured, with the 1/ω³ tail
    expect: { against: 'f-sum (π/2) ω_p² Σf, closed form', tolerance: 0.001 }
  - id: f-sum-glass
    statement: >-
      In glass, with two resonances sharing the electrons, the sum is the same (π/2)ω_p² within 1e−3.
    readout: f-sum ∫ω Im χ dω, measured, with the 1/ω³ tail
    expect: { against: 'f-sum (π/2) ω_p² Σf, closed form', tolerance: 0.001 }
    setup:
      params: { mode: glass }
  - id: normal-dispersion
    statement: >-
      In glass's transparent window the index rises with frequency: n at 1.4 ω₀ exceeds n at 0.8 ω₀.
    readout: n at 1.4 ω₀ less n at 0.8 ω₀, in the transparent window
    expect: { above: 0 }
    setup:
      params: { mode: glass }
  - id: clausius-mossotti
    statement: >-
      Corrected for the neighbours' field at ω_p² = 1.5 ω₀², the absorption peaks at √(ω₀² − fω_p²/3) =
      0.7071 ω₀ within 0.003 (the damping moves a Lorentzian's peak by a few parts in a thousand).
    readout: absorption peak of the main resonance, measured (ω over ω₀)
    expect: { against: 'peak moved by the neighbours’ field, √(ω₀² − fω_p²/3)', tolerance: 0.003 }
    setup:
      params: { dense: true, wp2: 1.5 }
  - id: plasma-edge
    statement: >-
      Free electrons at ω_p² = 2 make Re ε cross zero at √(ω_p² − γ²) within 1e−3; below it the metal reflects.
    readout: 'plasma edge: where Re ε = 1 + Re χ crosses zero, measured'
    expect: { against: 'plasma edge √(ω_p² − γ²), closed form', tolerance: 0.001 }
    setup:
      params: { mode: plasma, wp2: 2 }
  - id: rayleigh
    statement: >-
      Far below the resonance, at 0.05 to 0.1 ω₀, the radiated power ω⁴|x|² rises with slope 4 on log axes
      within [3.99, 4.05]; the next term, 4ω²/(ω₀² − ω²), adds about 0.02 here.
    readout: 'Rayleigh: slope of ln(ω⁴|x|²) against ln ω, far below the resonance'
    expect: { range: [3.99, 4.05] }
---

A medium made of electrons on springs, driven by light: one kind of bound electron with its resonance, a glass with an infrared and an ultraviolet resonance, and free electrons as in a plasma or a metal.

**The model.** Each electron obeys ẍ + γẋ + ω_j²x = (q/m)E cos ωt, the equation of #/p/driven-oscillator. The plate does not write down its solution: it integrates the oscillator by RK4 from rest, waits until the start has died away, and locks in on the drive over twenty whole periods to read the amplitude and the phase lag. The polarisation of all the electrons, N q x, over ε₀E, is the susceptibility χ; a fraction f_j of them in each resonance, with ω_p² = Nq²/(ε₀m) setting the density. The index is n + iκ = √(1 + χ): n sets the speed of the phase, κ how fast the wave decays. The Lorentz sum Σf_jω_p²/(ω_j² − ω² − iγ_jω) is printed beside the measurement as what it is held to.

**Dispersion and absorption.** Below a resonance the electrons follow the field in phase, add to it, and the index exceeds one, rising towards the resonance; there they absorb, a band of width γ; just above it they move against the field and the index falls below one. Glass has resonances in the infrared and the ultraviolet and a window between them where it is clear and its index rises gently, which is why a prism bends blue more than red. The dense toggle adds the field of the neighbouring dipoles, E + P/3ε₀ in place of E: the Clausius–Mossotti relation, which moves the resonance down to √(ω₀² − fω_p²/3).

**Causality.** A medium cannot respond before it is driven, and that alone ties the real part of χ to the imaginary part: Re χ is the Hilbert transform of Im χ, the Kramers–Kronig relation. The plate takes the measured absorption over 512 frequencies, extends it as an odd function and transforms it by the FFT method of #/p/hilbert-analytic, and compares with the measured Re χ. The same causality gives the sum rule: ∫ω Im χ dω = (π/2)ω_p² Σf, however the electrons are shared between resonances.

**Metals.** Free electrons have no spring: the index squared is 1 − ω_p²/(ω² + γ²) for weak damping, negative below the plasma frequency, so the wave decays within a fraction of a wavelength and is reflected. That edge is why metals shine and why the ionosphere reflects radio but not light.

**Rayleigh scattering.** Far below its resonance an electron's displacement barely depends on frequency, and the power a dipole radiates goes as ω⁴|x|². The slope of that power against frequency on log axes, measured from five lock-ins, is 4: blue light at 450 nm is scattered about six times as much as red at 700 nm, which is the blue of the sky.
