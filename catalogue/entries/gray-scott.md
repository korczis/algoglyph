---
id: gray-scott
title: Turing Garden
taxonomy: dynamics/patterns
status: live
engine: custom
tags:
  - reaction-diffusion
  - Turing patterns
  - PDE
complexity: O(cells) per step, explicit Euler
interaction: Click or drag to seed chemical V.
---

Two chemicals, one feeding and one eating, diffusing at different speeds: the Gray-Scott model grows coral, divides cells and draws mazes. Paint to seed it.

Chemical U is fed in at rate f; V converts U into more V (U + 2V → 3V) and is removed at rate f + k. U diffuses twice as fast as V. Those four numbers are all there is, yet they produce the spots, stripes and labyrinths Alan Turing predicted in 1952 for morphogenesis.

Integrated with explicit Euler steps on a torus with a nine-point Laplacian. Colour is the concentration of V. Each preset is a point in the (f, k) plane; nudging f or k by a few thousandths crosses into a different regime.

Click and drag to drop V into the dish.
