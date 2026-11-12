---
id: sobol-indices
title: Sobol sensitivity indices
taxonomy: inference/attribution
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - sensitivity
  - variance decomposition
complexity: "N (d + 2) model evaluations for d inputs"
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
  - Tell an input's first-order index, its own share of the variance, from its total index.
  - Recognise an input that acts only through an interaction, as the Ishigami function's third.
  - Check an additive model, whose first-order and total indices coincide and sum to one.
algorithm:
  paradigm: randomized
bounds:
  model: model evaluations
  best: N(d + 2)
  worst: N(d + 2)
claims:
  - id: ishigami-indices-near-analytic
    statement: >-
      On the Ishigami function with N = 4,000 every first-order and total index lies within 0.066
      of its analytic value, so the third input's first-order index is near 0 and its total index
      near 0.244. The margin is the mean (0.025) plus four standard deviations (0.010) of the
      largest error over 200 other seeds; four, because a largest error is skewed.
    readout: Largest error against analytic
    expect: { below: 0.066 }
  - id: additive-first-order-sums-to-one
    statement: >-
      On the additive model the first-order indices sum to one, within three standard deviations
      (0.019) of the sum over 200 other seeds.
    readout: Sum of first-order indices
    expect: { value: 1, tolerance: 0.058 }
    setup:
      params: { model: additive }
  - id: additive-first-order-and-total-coincide
    statement: >-
      On the additive model first-order and total indices both lie within 0.044 of the analytic
      a_i² / Σ a_j²: the mean (0.016) plus four standard deviations (0.007) of the largest error
      over 200 other seeds.
    readout: Largest error against analytic
    expect: { below: 0.044 }
    setup:
      params: { model: additive }
  - id: without-a-the-second-input-drops-out
    statement: >-
      At Ishigami a = 0 the term a sin² x₂ vanishes and f no longer depends on x₂, so every hybrid
      f(A_B(2)) equals f(A) exactly: the second input's first-order estimate is exactly 0.
    readout: Indices of x2
    expect: { value: 0, tolerance: 0 }
    setup:
      params: { a: 0 }
  - id: without-a-the-second-total-is-its-first
    statement: >-
      For the same reason the second input's total estimate, half the mean square of
      f(A) − f(A_B(2)), is exactly 0 too: it equals the first-order estimate to the last digit.
    readout: Indices of x2
    expect: { against: Indices of x2, against_number: 2, tolerance: 0 }
    setup:
      params: { a: 0 }
  - id: without-a-indices-near-analytic
    statement: >-
      At a = 0 the analytic indices are V₁/V = 0.563 and V₁₃/V = 0.437 for the first and third
      inputs, V₂ = a²/8 = 0; every estimate lies within 0.120 of its analytic value with
      N = 4,000, the mean (0.039) plus four standard deviations (0.020) of the largest error over
      200 other seeds.
    readout: Largest error against analytic
    expect: { below: 0.120 }
    setup:
      params: { a: 0 }
  - id: large-a-indices-near-analytic
    statement: >-
      At a = 10 the second input's share is V₂/V = (100/8)/V = 0.618, and every estimate lies
      within 0.057 of its analytic value with N = 4,000, the mean (0.022) plus four standard
      deviations (0.009) of the largest error over 200 other seeds.
    readout: Largest error against analytic
    expect: { below: 0.057 }
    setup:
      params: { a: 10 }
  - id: without-b-the-third-input-drops-out
    statement: >-
      At Ishigami b = 0 the interaction b x₃⁴ sin x₁ vanishes and f no longer depends on x₃, so
      every hybrid f(A_B(3)) equals f(A) exactly: the third input's first-order estimate is
      exactly 0.
    readout: Indices of x3
    expect: { value: 0, tolerance: 0 }
    setup:
      params: { b: 0 }
  - id: without-b-the-third-total-is-zero
    statement: >-
      For the same reason the third input's total estimate is exactly 0 as well, where at the
      default b = 0.1 it is near V₁₃/V = 0.244: it equals the first-order estimate to the last
      digit.
    readout: Indices of x3
    expect: { against: Indices of x3, against_number: 2, tolerance: 0 }
    setup:
      params: { b: 0 }
  - id: without-b-indices-near-analytic
    statement: >-
      At b = 0 the function is additive, sin x₁ + 7 sin² x₂, with analytic indices
      0.5 / 6.625 = 0.075 and (49/8) / 6.625 = 0.925; every estimate lies within 0.056 of its
      analytic value with N = 4,000, the mean (0.017) plus four standard deviations (0.010) of
      the largest error over 200 other seeds.
    readout: Largest error against analytic
    expect: { below: 0.056 }
    setup:
      params: { b: 0 }
  - id: large-b-indices-near-analytic
    statement: >-
      At b = 0.3 the interaction carries half the variance, V₁₃/V = 0.507, and every estimate
      lies within 0.120 of its analytic value with N = 4,000, the mean (0.040) plus four
      standard deviations (0.020) of the largest error over 200 other seeds.
    readout: Largest error against analytic
    expect: { below: 0.120 }
    setup:
      params: { b: 0.3 }
---

The share of output variance each input explains, alone and with the others.

The first-order index of an input is the share of the output's variance its own variation explains; the total index adds every interaction it takes part in. Both come from two independent sample matrices and the hybrids that swap in one column: the first-order estimator of Saltelli (2010) and the total-effect estimator of Jansen.

On the Ishigami function the third input has no first-order effect at all yet a total index near 0.24 at the defaults a = 7 and b = 0.1 (both controls), because it acts only through its interaction with the first. On an additive model first-order and total indices coincide and sum to one; the ticks are the analytic values.
