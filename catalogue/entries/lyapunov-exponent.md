---
id: lyapunov-exponent
title: Largest Lyapunov exponent
taxonomy: dynamics/chaos
status: live
engine: numeric
sources:
  - id: practice-decisions
  - id: benettin-1980-lyapunov
    purpose: algorithm-reference
  - id: sprott-lorenz-lyapunov
    purpose: data
tags:
  - lyapunov
  - divergence
  - chaos
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'linear in the integration time; the estimate converges slowly, like a mean'
related:
  - poincare-section
  - takens-embedding
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Advance a reference orbit and a neighbour 10⁻⁸ away together, add up the logarithmic growth of their separation and pull the neighbour back to the original distance along the same direction.
    - See why the renormalisation keeps the pair sampling the fastest-growing direction without leaving the linear regime.
    - Watch the running mean converge towards ln 2 for the logistic map at r = 4 and towards about 0.906 for the Lorenz flow.
    - Find a negative exponent at r = 3.5, where the orbit is a stable 4-cycle.
  misconceptions:
    - The running estimate is not the exponent after a few intervals; it converges slowly, like a mean.
bounds:
  model: renormalisations of the neighbour
  best: 'one every 10 RK4 steps of h 0.01 for the flow, 2000 over T 200; one per iteration, 20000, for a map'
  worst: 'one every 10 RK4 steps of h 0.01 for the flow, 2000 over T 200; one per iteration, 20000, for a map'
claims:
  - id: logistic-at-4-is-ln-2
    statement: >-
      The logistic map at r = 4 is conjugate to the tent map by x = sin²(πy/2), whose slope is 2
      everywhere, so the sum of the log growth telescopes: the estimate after N iterations is
      ln 2 + (ln|sin πy_N| − ln|sin πy_0|)/N, an error O(1/N). With N = 20000 that is within
      0.005 of ln 2 = 0.6931 whenever both ends keep |ln|sin πy|| below about 50; the identity
      and the end terms are checked in test/lyapunov-exponent-claims.test.ts.
    readout: Running estimate λ
    expect: { value: 0.6931, tolerance: 0.005 }
    setup:
      params: { system: logistic }
  - id: four-cycle-exponent
    statement: >-
      At r = 3.5 the 1000 iterations before measuring put the orbit on the attracting 4-cycle to
      machine precision (it contracts by e^(4λ) ≈ 0.03 a cycle), so every four renormalisations
      add ln|Π r(1 − 2x_i)| over the cycle: the exponent is that over 4, −0.87251, computed in the
      test from the cycle itself; within 0.001, the printed digits and the 10⁻⁸ linearisation.
    readout: Running estimate λ
    expect: { value: -0.8725, tolerance: 0.001 }
    setup:
      params: { system: logistic-periodic }
  - id: lorenz-near-sprott
    statement: >-
      Sprott's long-run largest exponent of the Lorenz flow at σ 10, ρ 28, β 8/3 is 0.906. A run
      of T = 200 estimates it with a spread of sd 0.0143 and a bias of −0.0046 over the seeds
      1 … 60 (disjoint from the claim's seed, in test/lyapunov-exponent-claims.test.ts); four sd
      plus the bias, 0.062, rounded up to the tolerance 0.065.
    readout: Running estimate λ
    expect: { value: 0.906, tolerance: 0.065 }
    source: sprott-lorenz-lyapunov
  - id: lorenz-renormalisations
    statement: >-
      The flow is renormalised every 10 steps of h = 0.01 over T = 200: exactly 200/(0.01 · 10) =
      2,000 renormalisations.
    readout: Renormalisations
    expect: { value: 2000 }
  - id: map-renormalisations
    statement: >-
      A map is renormalised once per iteration, over 20,000 iterations: exactly 20,000
      renormalisations.
    readout: Renormalisations
    expect: { value: 20000 }
    setup:
      params: { system: logistic }
---

Two nearby trajectories, their separation renormalised and averaged into a growth rate.

A reference orbit and a neighbour 10⁻⁸ away are advanced together. After each interval their separation is measured, its logarithmic growth added up, and the neighbour pulled back to the original distance along the same direction, so the pair keeps sampling the fastest-growing direction without leaving the linear regime.

The running mean converges towards the exponent: ln 2 for the logistic map at r = 4, which the test checks, and published values of about 0.906 for the Lorenz flow and 0.419 for the Hénon map. At r = 3.5 the orbit is a stable 4-cycle and the exponent is negative.
