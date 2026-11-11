---
id: ising-model
title: Magnet Weather
taxonomy: physics/statistical
status: live
engine: custom
tags:
  - statistical mechanics
  - phase transition
  - Monte Carlo
complexity: O(spins) per sweep, Metropolis single-spin flips
interaction: Click or drag to paint a patch of spins opposite to the one under the pointer.
---

A sheet of tiny magnets, each nudged by its four neighbours and shaken by heat: the 2D Ising model freezes into one colour, boils into noise, and at the critical temperature becomes clouds of every size.

Every cell is a spin, up or down, on a square lattice that wraps around at the edges. Neighbouring spins that agree lower the energy by one unit and a field h favours one sign. Each sweep proposes flipping every spin once, in checkerboard order, and keeps the flip with the Metropolis probability min(1, e^(−ΔE/T)), where ΔE = 2s(Σ neighbours + h). Bright cells are spins that flipped in the last frames; colours follow a short time-average of each spin.

Onsager solved this model exactly in 1944: with h = 0 it orders below the critical temperature Tc = 2/ln(1 + √2) ≈ 2.269. Well below it one colour takes over and |m| approaches Yang's spontaneous magnetisation (1 − sinh⁻⁴(2/T))^(1/8); well above it the sheet is salt and pepper with m near 0. Near Tc domains of every size drift and merge. A perfectly aligned sheet has energy −2 per spin.

Start ordered and raise T past Tc to watch the magnet melt; start random below Tc and domains coarsen slowly, sometimes lingering as stripes around the torus. A small h ends the stand-off in favour of one sign.
