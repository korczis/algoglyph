---
id: isotonic-calibration
title: Calibration by isotonic regression
taxonomy: inference/calibration
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - calibration
  - isotonic
  - reliability diagram
complexity: "linear after sorting the scores"
related:
  - base-rate-roc
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Run pool adjacent violators with a stack of blocks, merging the top block while its frequency is below the one beneath it.
    - Explain that the fit is the non-decreasing step function closest to the labels in squared error, so it never reverses two cases' order, though it may tie them.
    - Measure calibration on held-out cases with the reliability diagram, the Brier score and the expected calibration error, so the fit does not grade itself.
algorithm:
  paradigm: incremental
claims:
  - id: held-out-calibration-error-falls
    statement: >-
      Measured on the held-out half, the isotonic fit lowers the expected calibration error: the
      error before calibration exceeds the error after it.
    readout: Expected calibration error
    expect: { against: Expected calibration error, against_number: 2, above: 0 }
  - id: brier-before-follows-the-slope-flat
    statement: >-
      With overconfident scores the true probability at score x is 0.5 + slope · (x − 0.5), and the
      scores are Beta(1.3, 1.3), of mean 1/2 and variance 5/72, so the raw scores' expected Brier
      score is E[x²] − 2E[x · t(x)] + E[t(x)] = (23 − 10 · slope) / 72. At slope 0, a truth that
      ignores the score, that is 23/72 = 0.3194; the 1,200 held-out cases read it within 0.032,
      four standard errors of the mean of (x − y)², whose standard deviation is 0.272.
    readout: Brier score (held out)
    expect: { value: 0.3194, tolerance: 0.032 }
    setup:
      params: { slope: 0 }
  - id: brier-before-follows-the-slope-steep
    statement: >-
      At slope 0.7 the raw scores' expected Brier score is (23 − 7) / 72 = 0.2222, read within
      0.027 from the 1,200 held-out cases: four standard errors, the standard deviation of
      (x − y)² there being 0.228. It is lower than at slope 0 by 7/72 = 0.097, far outside both
      margins, so the reading follows the control.
    readout: Brier score (held out)
    expect: { value: 0.2222, tolerance: 0.027 }
    setup:
      params: { slope: 0.7 }
  - id: held-out-calibration-error-falls-flat-truth
    statement: >-
      When the truth ignores the score (slope 0) every score but 0.5 is overconfident, and the
      isotonic fit lowers the held-out expected calibration error: the error before exceeds the
      error after.
    readout: Expected calibration error
    expect: { against: Expected calibration error, against_number: 2, above: 0 }
    setup:
      params: { slope: 0 }
  - id: held-out-calibration-error-falls-steep-truth
    statement: >-
      At slope 0.7, the top of the control, the scores are the least overconfident the plate
      offers, and the isotonic fit still lowers the held-out expected calibration error: the error
      before exceeds the error after.
    readout: Expected calibration error
    expect: { against: Expected calibration error, against_number: 2, above: 0 }
    setup:
      params: { slope: 0.7 }
---

Pool adjacent violators until confidence rises with accuracy; the reliability diagram before and after.

Pool adjacent violators keeps a stack of blocks: each new case opens a block, and while the top block's observed frequency is below the one beneath it the two are merged. The result is the non-decreasing step function closest to the labels in squared error, so calibration never reverses the order of two cases, though it may tie them.

The fit uses one half of the synthetic data; the reliability diagram and the Brier score and expected calibration error are measured on the other half, so the improvement shown is not the fit grading itself. Overconfident scores sit below the diagonal at the high end and above it at the low end.
