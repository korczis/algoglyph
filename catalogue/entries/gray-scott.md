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
sources:
  - id: pearson-1993-gray-scott
    purpose: algorithm-reference
  - id: turing-1952-morphogenesis
    purpose: history
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - See two chemicals, one feeding and one eating, diffusing at different speeds grow coral, divide cells and draw mazes.
    - Name the four numbers that are all there is, the feed f, the kill k and the two diffusion rates, and see them produce the spots, stripes and labyrinths Turing predicted.
    - Nudge f or k by a few thousandths and cross into a different regime of the (f, k) plane.
    - Turn the drops off, add a small uniform V and see it decay at the linearised rate (1 − (f + k))^steps about the uniform state (u, v) = (1, 0).
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
bounds:
  model: cell updates, one per cell per explicit Euler step
  best: 'cells · steps'
  worst: 'cells · steps'
claims:
  - id: perturbation-decays-at-the-linear-rate-coral
    statement: >-
      With no drops the dish is uniform, so the Laplacian vanishes and each cell takes the Euler
      step (dt = 1) alone: v' = (1 − (f + k))·v + u·v². About (u, v) = (1, 0) the linear rate is
      r = 1 − (f + k) = 0.8835 for coral (f 0.0545, k 0.062), so ε = 1e-4 (1e-4 to float32's
      7 digits) is ε·r⁵⁰ = 2.0433e-7 after 50 steps. The quadratic term only adds: u stays exactly
      1 (u·v² < 2^−25 rounds away in float32), v_n = ε·rⁿ·Π(1 + v_m/r) and the product is below
      e^(c(1 + c)) with c = ε/(r(1 − r)) = 9.7e-4; each step rounds to float32 (2^−24), so the
      mean lies in 2.04327e-7 … 2.04527e-7, read at four digits as 2.043e-7 … 2.046e-7.
    readout: mean V
    expect: { range: [2.043e-7, 2.046e-7] }
    setup:
      params: { drops: false, dv: 0.0001, runs: 50 }
  - id: perturbation-decays-at-the-linear-rate-mitosis
    statement: >-
      For mitosis (f 0.0367, k 0.0649) r = 0.8984, so after 100 steps ε·r¹⁰⁰ = 2.22318e-9; with c =
      ε/(r(1 − r)) = 1.1e-3 and the float32 rounding the mean lies in 2.22317e-9 … 2.22563e-9,
      2.223e-9 … 2.226e-9 at four digits.
    readout: mean V
    expect: { range: [2.223e-9, 2.226e-9] }
    setup:
      params: { preset: mitosis, drops: false, dv: 0.0001, runs: 100 }
  - id: perturbation-decays-at-the-linear-rate-turbulence
    statement: >-
      For the turbulence preset (f 0.026, k 0.051) r = 0.923, the slowest decay of the presets:
      after 200 steps ε·r²⁰⁰ = 1.09734e-11, and with c = 1.4e-3 the mean lies in 1.09732e-11 …
      1.09890e-11, 1.097e-11 … 1.099e-11 at four digits.
    readout: mean V
    expect: { range: [1.097e-11, 1.099e-11] }
    setup:
      params: { preset: chaos, drops: false, dv: 0.0001, runs: 200 }
---

Two chemicals, one feeding and one eating, diffusing at different speeds: the Gray-Scott model grows coral, divides cells and draws mazes. Paint to seed it.

Chemical U is fed in at rate f; V converts U into more V (U + 2V → 3V) and is removed at rate f + k. U diffuses twice as fast as V. Those four numbers are all there is, yet they produce the spots, stripes and labyrinths Alan Turing predicted in 1952 for morphogenesis.

Integrated with explicit Euler steps on a torus with a nine-point Laplacian. Colour is the concentration of V. Each preset is a point in the (f, k) plane; nudging f or k by a few thousandths crosses into a different regime.

Click and drag to drop V into the dish. With the drops off the dish is the uniform state (u, v) = (1, 0), an exact fixed point; a small uniform V added to it decays, since each step multiplies it by 1 − (f + k) to first order.
