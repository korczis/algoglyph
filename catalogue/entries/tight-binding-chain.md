---
id: tight-binding-chain
title: An Electron on a Chain of Atoms
taxonomy: physics/quantum
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - tight binding
  - energy band
  - lattice wave packet
  - impurity scattering
sources:
  - id: feynman-lectures
    ref: 'Vol. III, ch. 13 (propagation in a crystal lattice: the band, wave packets, scattering and trapping by an imperfection)'
    purpose: further-reading
  - id: ashcroft-mermin-1976
    ref: 'Chapter 10: the tight-binding method'
    purpose: implementation
  - id: crank-nicolson-1947
    purpose: implementation
tags:
  - tight binding
  - energy band
  - dispersion relation
  - group velocity
  - bound state
  - transmission
  - Crank–Nicolson
  - Sturm sequence
complexity: O(N² log(1/ε)) for the spectrum by bisection; O(N) per Crank–Nicolson step, a few thousand steps a run
interaction: Choose the experiment; for the band, the chain's length and the impurity at its middle site; for a packet, its wavenumber and width, and the impurity it meets.
motivation: An electron that can only hop from atom to neighbouring atom has energies that fill a band, −2A cos kb, and travels through a perfect crystal without hindrance; one odd atom traps it or scatters it, by amounts that follow from the same band.
relations:
  - type: compares_with
    target: bound-states
    reason: The chain's matrix is the finite-difference Schrödinger operator of that plate with the grid step 1/√(2A), so its band is found by the same Sturm bisection; there the step is small and the levels are a well's, here it is the lattice itself.
  - type: related_to
    target: quantum-tunnelling
    reason: A packet meeting a barrier in the continuum there, a packet meeting one odd site here; in both the transmitted share is a closed form averaged over the packet's wavenumbers.
  - type: related_to
    target: fft-butterfly
    reason: The chain's stationary states are sine waves on the lattice; on a ring they would be the discrete Fourier modes the transform computes.
pedagogy:
  difficulty: intermediate
  objectives:
    - Find the energies of a chain of N sites and match them to the band −2A cos(nπ/(N + 1)).
    - Measure the speed of a wave packet and compare it with the group velocity dE/dk = 2Ab sin k₀.
    - Find the state an impurity binds outside the band, at sign(ε)√(ε² + 4A²), and its decay e^(−κ|n|) with κ = asinh(|ε|/2A).
    - Measure the share of a packet that passes an impurity and hold it to 1/(1 + (ε/2A sin k)²) averaged over the packet.
  misconceptions:
    - A perfect crystal does not scatter an electron; a packet moves through it at its group velocity, and only an imperfection turns some of it back.
    - The group velocity is not the phase velocity; at k₀b = π/2 the packet moves fastest while its energy is at the band's centre, and near k₀b = π it slows to a stop.
    - Any impurity, attractive or repulsive, binds a state in one dimension; a repulsive one binds it above the band.
  questions:
    - Why does a packet with k₀b = π/2 move at nearly 2Ab per unit time and one with k₀b = π/20 at a sixth of it?
    - What happens to the transmission as k₀ approaches the band's edge, and why?
    - How far does the bound state of ε = 1 reach before it falls to a tenth?
    - Why does Crank–Nicolson keep the norm exactly but slow the packet slightly away from the band's centre?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - One orbital per site, nearest-neighbour hopping A = 1, ħ = 1, sites one unit apart, the chain open at both ends.
  invariants:
    - Crank–Nicolson is unitary, so the norm stays 1 to round-off.
    - The impurity sits at the chain's middle site, or at site 300 of the packet's chain of 600.
  limitations:
    - Crank–Nicolson turns an energy E by 2 atan(EΔt/2) a step rather than EΔt, so a packet away from the band's centre moves slower by the factor 1/(1 + (EΔt/2)²), about 3e−4 at Δt = 0.02.
    - The packet's chain is 600 sites long and the packet travels 240 of them; a wider or slower packet is not run further.
    - The ring and longer-range hopping are not modelled.
experiments:
  - id: perfect-band
    title: The band of a perfect chain
    params: { experiment: band, impurity: 0 }
    observe: Sixty energies lie on −2A cos(nπ/61), dense near the band's edges and sparse in its middle.
  - id: bound-above
    title: A repulsive impurity binds a state above the band
    params: { experiment: band, impurity: 1 }
    observe: One energy leaves the band to √5 ≈ 2.236, and its state alternates in sign and decays as e^(−0.481|n|).
  - id: bound-below
    title: A deep attractive impurity
    params: { experiment: band, impurity: -2.5, sites: 400 }
    observe: The bound state sits at −√(6.25 + 4) ≈ −3.20, tightly held, decaying by e^(−1.05) a site.
  - id: fastest-packet
    title: The fastest packet
    params: { experiment: packet, k0: 0.5 }
    observe: At k₀b = π/2 the packet moves at 2Ab per unit time, the top of the group velocity.
  - id: slow-packet
    title: A slow packet near the band's bottom
    params: { experiment: packet, k0: 0.05, sigma: 40 }
    observe: At k₀b = π/20 it moves at 2 sin(π/20) ≈ 0.313 sites per unit time and spreads as it goes.
  - id: partial-transmission
    title: A packet split by an impurity
    params: { experiment: defect, k0: 0.5, impurity: 1 }
    observe: Four fifths pass and one fifth is reflected, as 1/(1 + (1/2)²) = 0.8 says.
  - id: strong-impurity
    title: A strong impurity near the band's bottom
    params: { experiment: defect, k0: 0.25, impurity: 2 }
    observe: Only a third passes; slow electrons are scattered more.
claims:
  - id: cosine-band
    statement: >-
      Sixty sites with no impurity have the energies −2A cos(nπ/(N + 1)) within 1e−12, found by Sturm bisection
      without knowing them.
    readout: 'largest |Eₙ − (−2A cos(nπ/(N + 1)))|, the cosine band'
    expect: { below: 0.000000000001 }
    setup:
      params: { impurity: 0 }
  - id: bound-state-energy
    statement: >-
      An impurity ε = A binds one state outside the band at √(ε² + 4A²) = √5 within 1e−10.
    readout: energy of the state outside the band, measured
    expect: { against: 'bound state of one impurity, sign(ε)√(ε² + 4A²)', tolerance: 0.0000000001 }
  - id: bound-state-decay
    statement: >-
      Its amplitude falls by e^(−κ) a site with κ = asinh(|ε|/2A) within 1e−8, read from the amplitudes four
      sites apart.
    readout: decay of the bound state κ, from its amplitudes
    expect: { against: 'decay, closed form asinh(|ε|/2A)', tolerance: 0.00000001 }
  - id: attractive-bound-state
    statement: >-
      On 400 sites an impurity ε = −2.5A binds its state below the band at −√(ε² + 4A²) within 1e−10.
    readout: energy of the state outside the band, measured
    expect: { against: 'bound state of one impurity, sign(ε)√(ε² + 4A²)', tolerance: 0.0000000001 }
    setup:
      params: { impurity: -2.5, sites: 400 }
  - id: group-velocity
    statement: >-
      A packet with k₀b = π/2 and σ = 15 sites moves at the mean group velocity 2Ab sin k₀ · e^(−1/8σ²) within
      1e−5; at the band's centre Crank–Nicolson adds no slowing.
    readout: speed of the packet’s centre ⟨n⟩, fitted (sites per unit time)
    expect: { against: 'group velocity 2Ab sin k₀ · e^(−1/8σ²), the packet’s mean', tolerance: 0.00001 }
    setup:
      params: { experiment: packet }
  - id: group-velocity-off-centre
    statement: >-
      At k₀b = π/5 the speed matches the group velocity within 5e−4, the slowing Crank–Nicolson brings there,
      (EΔt/2)² ≈ 2.6e−4 of it.
    readout: speed of the packet’s centre ⟨n⟩, fitted (sites per unit time)
    expect: { against: 'group velocity 2Ab sin k₀ · e^(−1/8σ²), the packet’s mean', tolerance: 0.0005 }
    setup:
      params: { experiment: packet, k0: 0.2 }
  - id: unitary
    statement: >-
      (numerics) Crank–Nicolson keeps the packet's norm within 1e−12 of 1 over the whole run.
    readout: norm − 1, largest, numerics
    expect: { below: 0.000000000001 }
    setup:
      params: { experiment: packet }
  - id: impurity-transmission
    statement: >-
      A packet at k₀b = π/2 meeting ε = A leaves the share 1/(1 + (ε/2A sin k)²), averaged over its wavenumbers,
      past the impurity within 1e−6.
    readout: probability past the impurity at the end, measured
    expect: { against: 'transmission |t(k)|² = 1/(1 + (ε/2A sin k)²), averaged over the packet', tolerance: 0.000001 }
    setup:
      params: { experiment: defect }
  - id: strong-impurity-transmission
    statement: >-
      At k₀b = π/4 and ε = 2A only about a third passes, again the averaged closed form within 1e−6.
    readout: probability past the impurity at the end, measured
    expect: { against: 'transmission |t(k)|² = 1/(1 + (ε/2A sin k)²), averaged over the packet', tolerance: 0.000001 }
    setup:
      params: { experiment: defect, k0: 0.25, impurity: 2 }
---

An electron hopping between neighbouring atoms of a chain: the energies of the chain against the cosine band, the state an odd atom binds outside it, a wave packet moving at the group velocity, and the share of it an impurity lets through.

**The model.** Each site holds one state, and the electron moves to a neighbour with amplitude A: the Hamiltonian has the site energies on its diagonal and −A beside it. With no impurity the stationary states are standing waves sin(nkb) with k = nπ/((N + 1)b), and their energies fill the band −2A cos kb, 4A wide. The plate does not use that. The chain's matrix is exactly the finite-difference Schrödinger operator of #/p/bound-states with the grid step 1/√(2A), shifted by 2A, so its energies come from the same Sturm bisection and its states from the same inverse iteration.

**An impurity.** Change one site's energy by ε and one state leaves the band: above it for ε > 0, below for ε < 0, at sign(ε)√(ε² + 4A²), however small ε is, as always in one dimension. Its amplitude decays away from the impurity as e^(−κ|n|), κ = asinh(|ε|/2A), and above the band it alternates in sign from site to site. The plate measures both from the computed state.

**A wave packet.** A Gaussian packet of wavenumber k₀ is evolved by Crank–Nicolson, one complex tridiagonal solve a step, which keeps the norm exactly. Its centre ⟨n⟩ moves in a straight line at the group velocity dE/dk = 2Ab sin kb averaged over the packet, 2Ab sin k₀ e^(−1/8σ²) for a width of σ sites. It is fastest at the band's centre and slows to nothing at its edges. Crank–Nicolson turns each energy by 2 atan(EΔt/2) a step, so away from the band's centre the packet is slowed by the factor 1/(1 + (EΔt/2)²); the claims state it.

**Scattering.** A packet meeting the impurity splits: the share 1/(1 + (ε/2A sin k)²) of each wavenumber passes and the rest is reflected. The plate averages that closed form over the packet's Gaussian spread of k and compares it with the probability found past the impurity when the run ends. Slow electrons, near the band's edges, are scattered most. A packet meeting a barrier in the continuum is #/p/quantum-tunnelling.
