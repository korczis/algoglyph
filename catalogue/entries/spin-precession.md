---
id: spin-precession
title: A Spin in a Magnetic Field
taxonomy: physics/quantum
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. III, ch. 6 (spin one-half), ch. 7 (the dependence of amplitudes on time), ch. 10 (other two-state systems)'
    purpose: further-reading
  - id: griffiths-qm
    ref: 'Chapter 4.4 (spin) and problem 4.30s on magnetic resonance'
    purpose: further-reading
tags:
  - spin
  - magnetic resonance
  - Rabi oscillation
  - Larmor precession
  - Crank–Nicolson
complexity: O(dim³) per Crank–Nicolson step, dim = 2j + 1 ≤ 4
interaction: Choose the experiment and the spin; each knob is a parameter of the run.
motivation: The smallest quantum system with a picture, and the one magnetic resonance imaging is built on.
relations:
  - type: analogue_of
    target: foucault-pendulum
    reason: Larmor's theorem; a magnetic field acts on a charged system as a rotating frame does, the Lorentz force qv×B standing in for the Coriolis force 2mv×Ω, so both precess.
  - type: related_to
    target: two-slit-amplitudes
    reason: Amplitudes that add before they are squared, there for two paths, here for the components of a spin.
  - type: uses
    target: gaussian-elimination
    reason: Each Crank–Nicolson step solves (I + ihH/2)ψ⁺ = (I − ihH/2)ψ by elimination with partial pivoting.
pedagogy:
  difficulty: intermediate
  objectives:
    - See a spin's average direction precess about a static field at γB, and in which sense.
    - Drive it with a rotating field and watch it flip completely on resonance, partly off it, as Rabi's formula says.
    - Rotate a spin ½ by a whole turn and find it changed in sign, a spin 1 not.
  misconceptions:
    - A full turn does not return a spin ½ to itself; it takes two.
    - Off resonance the spin does not flip less often but less far, and faster.
    - The arrow on the sphere is the average of the spin's components, not a classical needle.
  questions:
    - At what detuning does the flip probability top out at one half?
    - Why does the sign a 2π turn gives not show in any single measurement, and how could an interferometer show it?
    - Which way does a spin precess for a positive γ, and why is the rotating field turned the same way?
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
  invariants:
    - The state stays normalised to rounding; Crank–Nicolson is unitary for a Hermitian H.
  limitations:
    - ħ = 1 and γ = 1, so fields and frequencies share one unit; no relaxation (T₁, T₂) is modelled.
    - The drive rotates in the lab frame and is integrated there, not in the rotating frame; Rabi's formula is the comparison, not the method.
experiments:
  - id: off-resonance
    title: Detuned by Ω₁
    params: { detune: 1 }
    observe: The flip tops out at one half and comes round faster.
  - id: spin-one-turn
    title: A spin 1 turned once
    params: { experiment: rotation, j: '1' }
    observe: The overlap is +1; only half-integer spins change sign.
  - id: precession
    title: Precession in a static field
    params: { experiment: larmor }
    observe: The arrow circles +z clockwise at γB₀.
claims:
  - id: larmor-rate
    statement: >-
      A spin ½ tilted 90° from a static field of 4 precesses at γB₀ = 4: the least-squares slope of its
      unwrapped azimuth over two turns agrees within 1e−5.
    readout: precession rate, measured from ⟨J⟩ (rad per unit time)
    expect: { against: 'Larmor rate γB₀', tolerance: 0.00001 }
    setup:
      params: { experiment: larmor }
  - id: rabi-on-resonance
    statement: >-
      Driven on resonance by a field rotating with its precession, a spin ½ flips completely after
      π/Ω: the flip probability, integrated in the lab frame, matches Rabi's formula within 1e−5.
    readout: flip probability at t = π/Ω, measured
    expect: { against: 'flip probability at t = π/Ω, Rabi’s formula Ω₁²/Ω²', tolerance: 0.00001 }
  - id: rabi-detuned
    statement: >-
      Detuned by Ω₁, the flip probability at its first maximum is Ω₁²/(Ω₁² + Δ²) = ½, matched within
      1e−5.
    readout: flip probability at t = π/Ω, measured
    expect: { against: 'flip probability at t = π/Ω, Rabi’s formula Ω₁²/Ω²', tolerance: 0.00001 }
    setup:
      params: { detune: 1 }
  - id: half-spin-changes-sign
    statement: >-
      A spin ½ rotated through 2π overlaps its starting state with −1 within 1e−6: the turn changes its
      sign.
    readout: overlap ⟨ψ₀|ψ⟩ after the rotation, real part
    expect: { value: -1, tolerance: 0.000001 }
    setup:
      params: { experiment: rotation }
  - id: spin-one-does-not
    statement: >-
      A spin 1 rotated through 2π overlaps its starting state with +1 within 1e−6.
    readout: overlap ⟨ψ₀|ψ⟩ after the rotation, real part
    expect: { value: 1, tolerance: 0.000001 }
    setup:
      params: { experiment: rotation, j: '1' }
  - id: rotation-matrix-element
    statement: >-
      For a spin 3/2 turned through 3π/4, the overlap matches the closed form cos²ʲ(α/2), the rotation
      matrix's corner element, within 1e−6.
    readout: overlap ⟨ψ₀|ψ⟩ after the rotation, real part
    expect: { against: 'overlap, closed form cos²ʲ(α/2)', tolerance: 0.000001 }
    setup:
      params: { experiment: rotation, j: '1.5', turns: 0.375 }
  - id: unitary
    statement: >-
      A numerics check: after 24,000 Crank–Nicolson steps the state's norm is 1 within 1e−10.
    readout: norm − 1, numerics
    expect: { range: [-0.0000000001, 0.0000000001] }
---

A spin in a magnetic field: the arrow is the average of its components, drawn on a sphere; beside it the run's own curve against the closed form.

**The model.** A spin j has 2j + 1 states, and its components Jx, Jy, Jz are matrices built from the ladder formula. In a field B the Hamiltonian is −γB·J (ħ = 1, γ = 1 here), and the state evolves by Crank–Nicolson steps with H taken at each step's midpoint: second order, and unitary to rounding, so the norm stays 1. Nothing about precession or resonance is put in by hand; the curves come from integrating the Schrödinger equation.

**Precession.** In a static field along z, a tilted spin's average direction circles the field at γB, clockwise for positive γ. The plate fits a line to the unwrapped azimuth over two turns and compares its slope with γB₀.

**Resonance.** A second, weaker field B₁ rotating in the plane, at a frequency near γB₀ and in the same sense as the precession, turns the spin over. Rabi's formula says the probability of finding it flipped is (Ω₁²/Ω²) sin²(Ωt/2), with Ω₁ = γB₁ and Ω = √(Ω₁² + Δ²) for detuning Δ: complete on resonance, partial and faster off it. The drive is integrated in the laboratory frame, so the formula is a check, not an input.

**A whole turn.** Rotating a state by α about x multiplies its overlap with the start by the rotation matrix's corner element, cos²ʲ(α/2). For a spin ½ a full turn gives −1: the state has changed sign, which no single measurement shows but an interferometer splitting a beam and turning one half can. A spin 1 comes back as itself. The same precession appears in #/p/foucault-pendulum, where the Earth's rotation turns the swing as a magnetic field turns a spin.
