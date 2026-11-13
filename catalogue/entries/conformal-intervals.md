---
id: conformal-intervals
title: Conformal prediction intervals
taxonomy: inference/uncertainty
status: live
engine: stochastic
labs:
  - uncertainty
sources:
  - id: practice-decisions
tags:
  - conformal
  - intervals
  - coverage
complexity: "one sort of the calibration residuals"
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Compute the split conformal radius as the ⌈(n + 1)(1 − α)⌉-th smallest absolute residual on calibration cases the model never saw.
    - State the guarantee and its condition, coverage of at least 1 − α and at most 1 − α + 1/(n + 1) for exchangeable cases, whatever the model.
    - Tell marginal coverage, averaged over cases, from coverage at each x, and see a constant-width band over- and under-cover where the noise changes.
  misconceptions:
    - A badly chosen model gives intervals that cover less often; it gives wider intervals that cover just as often.
claims:
  - id: covers-at-the-guaranteed-rate
    statement: >-
      Over 150 repeated experiments with 60 calibration cases, the 90% split conformal interval
      covers between 1 − α = 90% and 1 − α + 1/(n + 1) ≈ 91.6% of test cases, give or take three
      standard errors of the repetition (about 1.1 points).
    readout: 90% intervals covering
    expect: { range: [88.9, 92.7] }
  - id: a-bad-model-is-no-less-honest
    statement: >-
      With a straight line fitted to the curved signal (degree 1), the 90% split conformal
      interval still covers between 90% and 91.6% of test cases over 150 experiments with 60
      calibration cases, give or take the same three standard errors (about 1.1 points): the
      spread of coverage comes from the calibration rank and the test sample, not from the model.
    readout: 90% intervals covering
    expect: { range: [88.9, 92.7] }
    setup:
      params: { degree: 1 }
  - id: covers-at-the-guaranteed-rate-at-50
    statement: >-
      Shown at the 50% level, the split conformal interval covers between 50% and
      50% + 1/61 ≈ 51.6% of test cases over 150 experiments with 60 calibration cases, give or take
      three standard errors (about 1.8 points): the coverage given one calibration draw is
      Beta(31, 31), k = ⌈61 · 0.5⌉ = 31, its variance 31 · 30/(61² · 62) plus the binomial
      variance of each experiment's test cases, over 150 experiments.
    readout: 50% intervals covering
    expect: { range: [48.2, 53.5] }
    setup:
      params: { level: "0.5" }
  - id: covers-at-the-guaranteed-rate-at-80
    statement: >-
      Shown at the 80% level, the split conformal interval covers between 80% and 81.6% of test
      cases over 150 experiments with 60 calibration cases, give or take three standard errors
      (about 1.4 points), from the Beta(49, 13) coverage of one calibration draw,
      k = ⌈61 · 0.8⌉ = 49, and the binomial spread of each experiment's test cases.
    readout: 80% intervals covering
    expect: { range: [78.5, 83.1] }
    setup:
      params: { level: "0.8" }
  - id: covers-at-the-guaranteed-rate-at-95
    statement: >-
      Shown at the 95% level, the split conformal interval covers between 95% and 96.6% of test
      cases over 150 experiments with 60 calibration cases, give or take three standard errors
      (about 0.8 points), from the Beta(58, 4) coverage of one calibration draw,
      k = ⌈61 · 0.95⌉ = 58, and the binomial spread of each experiment's test cases.
    readout: 95% intervals covering
    expect: { range: [94.2, 97.5] }
    setup:
      params: { level: "0.95" }
  - id: fewest-calibration-cases-still-cover-at-95
    statement: >-
      With the fewest calibration cases, 19, the 95% radius is the largest of them,
      k = ⌈20 · 0.95⌉ = 19, and covers exactly 19/20 = 95% of new cases on average, give or take
      three standard errors of 150 experiments (1.22 points, held to 1.3) from the Beta(19, 1)
      coverage of one calibration draw and the binomial spread of each experiment's test cases.
    readout: 95% intervals covering
    expect: { value: 95, tolerance: 1.3 }
    setup:
      params: { level: "0.95", ncal: 19 }
  - id: fewest-training-cases-cover-at-the-guaranteed-rate
    statement: >-
      Fitted on only 10 training cases, the 90% split conformal interval still covers between 90%
      and 91.6% of test cases over 150 experiments with 60 calibration cases, give or take the
      same three standard errors (about 1.1 points): the guarantee needs only exchangeable
      calibration and test cases, so the training size changes the width, never the coverage.
    readout: 90% intervals covering
    expect: { range: [88.9, 92.7] }
    setup:
      params: { ntrain: 10 }
  - id: overfitted-model-covers-at-the-guaranteed-rate
    statement: >-
      A degree-7 polynomial fitted on 10 training cases, nearly interpolating them, still gives a
      90% split conformal interval covering between 90% and 91.6% of test cases over 150
      experiments, give or take the same three standard errors (about 1.1 points).
    readout: 90% intervals covering
    expect: { range: [88.9, 92.7] }
    setup:
      params: { ntrain: 10, degree: 7 }
  - id: most-training-cases-cover-at-the-guaranteed-rate
    statement: >-
      Fitted on 400 training cases, the 90% split conformal interval covers between 90% and 91.6%
      of test cases over 150 experiments, give or take the same three standard errors (about 1.1
      points): the training size moves the width, never the coverage.
    readout: 90% intervals covering
    expect: { range: [88.9, 92.7] }
    setup:
      params: { ntrain: 400 }
---

Intervals from held-out residuals that cover the truth at the stated rate.

Split conformal prediction fits the model on training cases only, then measures absolute residuals on calibration cases the model never saw. If the calibration and test cases are exchangeable, the ⌈(n + 1)(1 − α)⌉-th smallest residual is a radius that covers a new case with probability at least 1 − α, and at most 1 − α + 1/(n + 1), whatever the model.

The guarantee is marginal: averaged over cases, not for each x. With noise that grows with x, the constant-width band over-covers on the left and under-covers on the right while the overall coverage stays at the nominal level; a badly chosen polynomial degree makes the band wider but no less honest.
