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
---

Pool adjacent violators until confidence rises with accuracy; the reliability diagram before and after.

Pool adjacent violators keeps a stack of blocks: each new case opens a block, and while the top block's observed frequency is below the one beneath it the two are merged. The result is the non-decreasing step function closest to the labels in squared error, so calibration never reverses the order of two cases, though it may tie them.

The fit uses one half of the synthetic data; the reliability diagram and the Brier score and expected calibration error are measured on the other half, so the improvement shown is not the fit grading itself. Overconfident scores sit below the diagonal at the high end and above it at the low end.
