---
id: quantum-tunnelling
title: Ghost Through the Wall
taxonomy: physics/waves
status: live
engine: custom
sources:
  - id: feit-fleck-steiger
  - id: cooley-tukey
  - id: griffiths-qm
    ref: 'Chapter 2: scattering states, the finite square barrier'
  - id: manolopoulos-cap
tags:
  - quantum mechanics
  - tunnelling
  - FFT
  - split-step
complexity: Split-step Fourier, O(N log N) per step, N = 2048
related:
  - ripple-tank
  - fft-butterfly
experiments:
  - id: resonance
    title: Two barriers
    params: { preset: double }
    observe: Between the barriers the packet rings; only the momenta near a resonance get through.
  - id: step
    title: A potential step
    params: { preset: step }
    observe: Part of the packet reflects though it has the energy to climb, a wave's behaviour.
  - id: narrow-packet
    title: A narrow packet
    params: { sigma: 2 }
    observe: A wider spread of momenta; the transmission averages over more of them and the plane-wave value says less.
claims:
  - id: packet-transmission
    statement: >-
      A Gaussian packet on the single barrier transmits the probability its plane waves' transfer-matrix
      transmission averages to over its momentum spread, within 0.25 percentage points: the split-step run and
      the matrix product share no code. (The gap measured at the default grid is 0.07 points.)
    readout: 'last run: transmitted / inside'
    expect: { against: 'packet-averaged T', tolerance: 0.25 }
    setup:
      params: { runs: 1 }
  - id: resonant-transmission
    statement: >-
      On the double barrier the same holds within 0.25 points, through the resonance's sharp peak.
    readout: 'last run: transmitted / inside'
    expect: { against: 'packet-averaged T', tolerance: 0.25 }
    setup:
      params: { preset: double, runs: 1 }
  - id: step-transmission
    statement: >-
      Over a potential step the transmitted share matches the packet average of the step's transmission
      within 0.25 points.
    readout: 'last run: transmitted / inside'
    expect: { against: 'packet-averaged T', tolerance: 0.25 }
    setup:
      params: { preset: step, runs: 1 }
  - id: norm-kept
    statement: >-
      (numerics) The probability on the grid plus what the absorbing edges took stays 1 within 1e−9 through
      the run: the split-step propagator is unitary.
    readout: norm, grid + absorbed
    expect: { value: 1, tolerance: 0.000000001 }
    setup:
      params: { runs: 1 }
---

A Gaussian wave packet runs into a barrier it classically cannot climb, and part of it comes out the other side. Below it, the whole history streams down as a space-time ribbon.

The time-dependent Schrödinger equation (ħ = m = 1) is solved on 2048 grid points, 0.1 apart, by the split-step Fourier method with Δt = 0.0125: half a step of potential phase, the exact kinetic phase e^{−ik²Δt/2} in momentum space through a radix-2 FFT, another half step of potential. Every step is unitary, so the norm only leaves through the absorbing edges, Manolopoulos' transmission-free absorbing potential, which keep count of what they take in: grid plus absorbed stays 1 to rounding.

The filled curve is |ψ|², drawn on the line of the packet's measured energy ⟨H⟩₀ so it can be read against the barrier height V₀; the thin lines are Re ψ and Im ψ. Every frame the probability is split three ways from the grid: reflected (left of the structure, plus what the left edge absorbed), inside (in a barrier or in the double barrier's well) and transmitted (right of it, plus the right edge), and the chart follows all three through the current run. The plane-wave T is the transfer-matrix transmission at ⟨H⟩₀; the packet-averaged T weights it over the packet's momentum spread. At every slider extreme the transmitted share ends a run within a percentage point of the packet-averaged T, once what is still inside is allowed to go either way; the gap left is the grid's sampling of the sharp barrier edges and the time step, largest for thin, high barriers hit hard.

Below the barrier top a thick barrier transmits about 16E(V₀ − E)/V₀² · e^{−2κa}, with κ = √(2(V₀ − E)); thin or low barriers leak more. The double barrier (a well 4 wide) lets little through except at resonant energies, where the plane-wave T reaches 1: tune k₀ to find one and watch the well ring and leak in the ribbon.
