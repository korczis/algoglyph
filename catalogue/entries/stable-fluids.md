---
id: stable-fluids
title: Stable fluids
taxonomy: physics/fluids
status: live
engine: custom
sources:
  - id: stam-stable-fluids
tags:
  - fluids
  - advection
  - projection
  - webassembly
complexity: O(n² · sweeps) per step, unconditionally stable
interaction: Drag across the box to push dye and momentum.
related:
  - ripple-tank
  - gray-scott
---

Diffuse, advect backwards along the velocity, and project out divergence: a fluid that never blows up.

The solver runs in WebAssembly, compiled from Rust; this plate only injects the seeded emitters and your drags, steps it, and draws the dye density it reads from the module's memory. The same Rust is tested natively, and the browser's build must reproduce the native build's fixture exactly.

Projection solves a Poisson equation by Gauss–Seidel sweeps. The readout shows the largest divergence before and after it: lower Solver sweeps per step and watch what is left grow, and the fluid start to compress.

Semi-Lagrangian advection traces each cell backwards along the velocity and interpolates, which is why no time step makes it blow up, and also why dye slowly smears: the total in the box is measured, not assumed.
