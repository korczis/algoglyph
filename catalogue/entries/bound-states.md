---
id: bound-states
title: Bound States in One Dimension
taxonomy: physics/quantum
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. III, ch. 2 (the uncertainty principle and the size of an atom), ch. 16 (the dependence of amplitudes on position), ch. 19 (the hydrogen atom)'
    purpose: further-reading
  - id: griffiths-qm
    ref: 'Ch. 2 (the time-independent Schrödinger equation) and ch. 4 (the hydrogen atom)'
    purpose: further-reading
tags:
  - Schrödinger equation
  - bound states
  - Sturm sequence
  - harmonic oscillator
  - hydrogen atom
  - quantum tunnelling
complexity: O(N) per Sturm count, O(N log ε) per level by bisection; O(N log N) per split-step in the double well
interaction: Choose the potential, how many levels to show, the wells' depth and the barrier between them, or the angular momentum of hydrogen; the lowest two states' superposition evolves as the run plays. Attach your own V(x).
motivation: Confine a particle and its energy can take only certain values; the box, the spring and the atom each have their ladder of levels, and two wells side by side share theirs by tunnelling.
relations:
  - type: related_to
    target: quantum-tunnelling
    reason: The same Schrödinger equation and the same split-step solver; there for a particle that escapes over and through barriers, here for one held by them.
  - type: compares_with
    target: gaussian-elimination
    reason: Both solve a linear system of the matrix; here the matrix is tridiagonal, so its eigenvalues come from Sturm counts and its eigenvectors from the Thomas algorithm in O(N), where elimination is O(N³) in general.
  - type: related_to
    target: spin-precession
    reason: The double well's lowest two states are a two-state system; a particle started in one well oscillates to the other at the splitting, as a spin flips at its Rabi frequency.
pedagogy:
  difficulty: intermediate
  objectives:
    - Find the energy levels of a potential as the eigenvalues of the finite-difference Hamiltonian, exactly, by counting the signs of a Sturm sequence.
    - Compare them with the closed forms for the box, the oscillator and hydrogen, and with the finite well's transcendental equations.
    - See that the n-th state has n − 1 nodes and that the oscillator's ground state has the least uncertainty, ΔxΔp = ½.
    - Watch the lowest two states' superposition tunnel from one well to the other in the time the splitting of their levels sets.
  misconceptions:
    - Higher levels of the box are not equally spaced; they grow as n², while the oscillator's are equally spaced and hydrogen's crowd together below zero.
    - A particle in the double well's ground state is not in one well or the other; it is in both at once, and only a superposition of two levels sits in one well.
    - Tunnelling does not happen at a speed set by the barrier's width alone; its time is π over the splitting, which falls exponentially as the barrier grows.
  questions:
    - Why does the grid's box level sit slightly below n²π²/2L², and by how much should it?
    - A deeper barrier makes the splitting smaller. How does the tunnelling time change if the barrier's height doubles?
    - Why do hydrogen's levels with the same n but different ℓ have the same energy?
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
  preconditions:
    - ψ vanishes at both ends of the grid; a potential is far from its levels there, or the walls are part of the problem (the box).
  limitations:
    - Second-order differences resolve a smooth potential to h², a step to only h, which is why the finite well's tolerance is larger.
    - The split-step solver's kinetic operator is the exact k², the eigensolver's the grid's (2 − 2 cos kh)/h²; behind a deep barrier the splitting, exponentially sensitive, differs between them by several per cent.
experiments:
  - id: low-barrier
    title: A low barrier
    params: { potential: double, v0: 4, barrier: 1 }
    observe: The particle crosses in a few time units, and the split-step solver and the eigenvalues agree on how fast.
  - id: high-barrier
    title: A high barrier
    params: { potential: double, v0: 16, barrier: 6 }
    observe: The levels pair up almost exactly and the crossing takes a hundred time units.
  - id: oscillator
    title: The harmonic oscillator
    params: { potential: harmonic, levels: 8 }
    observe: Equally spaced levels, and the n-th state with n − 1 nodes.
  - id: hydrogen-d
    title: Hydrogen, ℓ = 2
    params: { potential: hydrogen, l: 2 }
    observe: The lowest level is −1/18, the n = 3 level, as it must be when n is at least ℓ + 1.
claims:
  - id: box-ground-level
    statement: >-
      The grid's lowest level in a box of width 2 is π²/8 within 10⁻⁵, the grid's leading error
      (πh/L)²/12 being about 10⁻⁶.
    readout: lowest levels, exact eigenvalues of the grid’s Hamiltonian
    expect: { against: 'closed form n²π²/2L²', tolerance: 1.0e-5 }
    setup:
      params: { potential: box, levels: 4 }
  - id: box-fourth-level
    statement: >-
      The fourth level is 16π²/8 within 3.6 × 10⁻⁴, twice the grid's leading error (4πh/L)²/12 of it.
    readout: lowest levels, exact eigenvalues of the grid’s Hamiltonian
    expect: { against: 'closed form n²π²/2L²', tolerance: 3.6e-4, number: 4, against_number: 4 }
    setup:
      params: { potential: box, levels: 4 }
  - id: sturm-is-exact
    statement: >-
      Numerics: Sturm bisection finds the discrete box's eigenvalues (1 − cos kπ/(N + 1))/h² to the
      printed 10⁻⁶, here the fourth.
    readout: lowest levels, exact eigenvalues of the grid’s Hamiltonian
    expect: { against: 'the grid’s own (1 − cos kπ/(N + 1))/h² (numerics)', tolerance: 1.0e-6, number: 4, against_number: 4 }
    setup:
      params: { potential: box, levels: 4 }
  - id: oscillator-levels
    statement: >-
      The harmonic oscillator's fourth level is 3½ within 4 × 10⁻⁴, and its ground level ½ within
      2 × 10⁻⁵, the grid's error growing with the level.
    readout: lowest levels, exact eigenvalues of the grid’s Hamiltonian
    expect: { against: 'closed form n + ½', tolerance: 4.0e-4, number: 4, against_number: 4 }
    setup:
      params: { potential: harmonic, levels: 4 }
  - id: least-uncertainty
    statement: >-
      The oscillator's ground state, computed as a vector, has ΔxΔp = ½, Heisenberg's least, within
      2 × 10⁻⁵.
    readout: ground state ΔxΔp, from the state
    expect: { value: 0.5, tolerance: 2.0e-5 }
    setup:
      params: { potential: harmonic }
  - id: hydrogen-ground-level
    statement: >-
      The radial equation's lowest s level is hydrogen's −1/2 hartree within 10⁻⁴.
    readout: lowest levels, exact eigenvalues of the grid’s Hamiltonian
    expect: { against: 'closed form −1/2n², n = n_r + ℓ + 1', tolerance: 1.0e-4 }
    setup:
      params: { potential: hydrogen, l: 0, levels: 4 }
  - id: hydrogen-degeneracy
    statement: >-
      With ℓ = 2 the lowest level is the n = 3 level, −1/18, within 10⁻⁵: the same energy as the
      third s level, the degeneracy of the Coulomb potential.
    readout: lowest levels, exact eigenvalues of the grid’s Hamiltonian
    expect: { against: 'closed form −1/2n², n = n_r + ℓ + 1', tolerance: 1.0e-5 }
    setup:
      params: { potential: hydrogen, l: 2, levels: 4 }
  - id: finite-well
    statement: >-
      The finite well's lowest level, depth 10 and half-width 1, meets the root of the matching
      condition k tan ka = κ, found by bisection, within 0.005; a step in V is resolved to first order
      in h, and h is 0.008.
    readout: lowest levels, exact eigenvalues of the grid’s Hamiltonian
    expect: { against: 'matching conditions k tan ka = κ, −k cot ka = κ, by bisection', tolerance: 0.005 }
    setup:
      params: { potential: finite, v0: 10 }
  - id: tunnelling-at-the-splitting
    statement: >-
      Started in one of two wells with a low barrier, the split-step solver's state turns its two
      components' relative phase at the splitting E₁ − E₀ of the eigenvalues within 10⁻³ (0.4 % of it):
      the two solvers' kinetic operators differ at O(h²).
    readout: splitting by the split-step solver, from the phase of ⟨φ₁|ψ⟩ against ⟨φ₀|ψ⟩
    expect: { against: 'splitting E₁ − E₀', tolerance: 1.0e-3 }
    setup:
      params: { potential: double, v0: 4, barrier: 1 }
  - id: nodes-count-the-level
    statement: >-
      Numerics: the fourth state of the oscillator has three nodes, as Sturm's oscillation theorem says
      the n-th must have n − 1.
    readout: 'nodes of each state (numerics: Sturm’s n − 1)'
    expect: { value: 3, tolerance: 0, number: 4 }
    setup:
      params: { potential: harmonic, levels: 4 }
data:
  - id: potential
    title: Your potential
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: 'position (ħ = m = 1)', min: -100, max: 100 }
      - { key: v, unit: 'energy (ħ = m = 1)', min: -1000, max: 1000 }
    rows: { min: 3, max: 1024 }
    bytes: 32768
    replaces: potential
    ignores: [v0, barrier, l]
    url_bytes: 1800
    note: V is taken as a straight line between the rows, sorted by x, on a grid spanning them with ψ = 0 at both ends; the levels shown are the lowest eigenvalues and their states, and the lowest two are superposed and evolved by their exact phases.
---

A particle held by a potential has a ladder of energies it can take. The plate finds them as the eigenvalues of the Schrödinger equation on a grid, exactly, and lets the lowest two beat against each other.

**The eigensolver.** On a grid of spacing h with ψ = 0 at both ends, −½ψ″ + Vψ is a symmetric tridiagonal matrix with diagonal 1/h² + Vᵢ and off-diagonal −1/2h². Factorising H − λ as LDLᵀ costs O(N), and the number of negative pivots is the number of eigenvalues below λ (Sturm's theorem), so each eigenvalue is bracketed and bisected to round-off. Its eigenvector comes from inverse iteration, a few solves of (H − σ)w = v by the Thomas algorithm with σ a hair from the eigenvalue. The n-th state has n − 1 nodes, which the plate counts.

**Closed forms.** A box of width L has levels n²π²/2L²; the grid's are exactly (1 − cos nπ/(N + 1))/h², slightly lower, the difference of order h². The harmonic oscillator's levels are n + ½, equally spaced, and its ground state has ΔxΔp = ½, the least the uncertainty principle allows; the plate computes ⟨x²⟩ and ⟨p²⟩ = ∫ψ′² from the state itself. The radial equation for u = rψ in hydrogen adds ℓ(ℓ + 1)/2r² to −1/r, and its levels are −1/2n² with n = n_r + ℓ + 1, so the lowest level with ℓ = 2 is the n = 3 level, as degenerate with the third s level as Coulomb's law makes it. The finite well's levels are the roots of the matching conditions k tan ka = κ and −k cot ka = κ, found by bisection without any grid.

**Tunnelling.** In two wells side by side the levels come in pairs, a symmetric and an antisymmetric state split by a small E₁ − E₀. Their sum sits in the left well, their difference in the right, and the superposition (ψ₀ + ψ₁)/√2 swings from one side to the other and back in the time 2π/(E₁ − E₀). The plate evolves it twice: by the exact phases e^(−iEₙt) of the eigenstates (filled), and by the split-step Fourier solver of #/p/quantum-tunnelling (dashed), which knows nothing of eigenstates. The splitting it shows is read from the relative phase of the state's two components. With a low barrier the two agree to a few parts in ten thousand; behind a high one they differ by several per cent, because the split-step's kinetic energy is the exact k² and the grid's is (2 − 2 cos kh)/h², and the splitting depends exponentially on the barrier the particle sees.

**Your potential.** A table of V(x) replaces the preset, straight between its rows and spanning them, with ψ = 0 at the two ends. The levels, their states and the superposition are computed for it. The table stays in the browser.
