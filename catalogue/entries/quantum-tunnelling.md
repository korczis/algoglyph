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
---

A Gaussian wave packet runs into a barrier it classically cannot climb, and part of it comes out the other side. Below it, the whole history streams down as a space-time ribbon.

The time-dependent Schrödinger equation (ħ = m = 1) is solved on 2048 grid points, 0.1 apart, by the split-step Fourier method with Δt = 0.0125: half a step of potential phase, the exact kinetic phase e^{−ik²Δt/2} in momentum space through a radix-2 FFT, another half step of potential. Every step is unitary, so the norm only leaves through the absorbing edges, Manolopoulos' transmission-free absorbing potential, which keep count of what they take in: grid plus absorbed stays 1 to rounding.

The filled curve is |ψ|², drawn on the line of the packet's measured energy ⟨H⟩₀ so it can be read against the barrier height V₀; the thin lines are Re ψ and Im ψ. Every frame the probability is split three ways from the grid: reflected (left of the structure, plus what the left edge absorbed), inside (in a barrier or in the double barrier's well) and transmitted (right of it, plus the right edge), and the chart follows all three through the current run. The plane-wave T is the transfer-matrix transmission at ⟨H⟩₀; the packet-averaged T weights it over the packet's momentum spread. At every slider extreme the transmitted share ends a run within a percentage point of the packet-averaged T, once what is still inside is allowed to go either way; the gap left is the grid's sampling of the sharp barrier edges and the time step, largest for thin, high barriers hit hard.

Below the barrier top a thick barrier transmits about 16E(V₀ − E)/V₀² · e^{−2κa}, with κ = √(2(V₀ − E)); thin or low barriers leak more. The double barrier (a well 4 wide) lets little through except at resonant energies, where the plane-wave T reaches 1: tune k₀ to find one and watch the well ring and leak in the ribbon.
