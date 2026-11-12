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
---

Intervals from held-out residuals that cover the truth at the stated rate.

Split conformal prediction fits the model on training cases only, then measures absolute residuals on calibration cases the model never saw. If the calibration and test cases are exchangeable, the ⌈(n + 1)(1 − α)⌉-th smallest residual is a radius that covers a new case with probability at least 1 − α, and at most 1 − α + 1/(n + 1), whatever the model.

The guarantee is marginal: averaged over cases, not for each x. With noise that grows with x, the constant-width band over-covers on the left and under-covers on the right while the overall coverage stays at the nominal level; a badly chosen polynomial degree makes the band wider but no less honest.
