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

The time-dependent Schrödinger equation (ħ = m = 1) is solved on 2048 grid points by the split-step Fourier method: half a step of potential phase, the exact kinetic phase e^{−ik²Δt/2} in momentum space through a radix-2 FFT, another half step of potential. Every step is unitary, so the norm only leaves through the absorbing edges, which keep count of what they take in: grid plus absorbed stays 1 to rounding.

The filled curve is |ψ|², drawn on the line of the packet's measured energy ⟨H⟩₀ so it can be read against the barrier height V₀; the thin lines are Re ψ and Im ψ. Reflected and transmitted probabilities are summed from the grid, plus what each edge absorbed, every frame, and the chart follows both through the current run. The plane-wave T is the transfer-matrix transmission at ⟨H⟩₀; the packet-averaged T weights it over the packet's momentum spread, and is what the transmitted share settles at.

Below the barrier top a thick barrier transmits about 16E(V₀ − E)/V₀² · e^{−2κa}, with κ = √(2(V₀ − E)); thin or low barriers leak more. The double barrier (a well 4 wide) lets little through except at resonant energies, where the plane-wave T reaches 1: tune k₀ to find one and watch the well ring and leak in the ribbon.
