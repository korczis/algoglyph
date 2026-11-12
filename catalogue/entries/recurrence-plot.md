---
id: recurrence-plot
title: Recurrence plot and quantification
taxonomy: dynamics/time-series
status: live
engine: numeric
sources:
  - id: practice-decisions
tags:
  - recurrence
  - rqa
  - regime change
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'O(N²) for N states'
related:
  - takens-embedding
---

When the trajectory returns near where it has been, drawn as a matrix whose texture changes with regime.

The series is delay-embedded and every pair of states compared; ε is set so that the chosen share of pairs recur. Periodic motion draws long diagonal lines, chaos short broken ones, noise isolated points; the logistic series that switches from period 4 to chaos halfway changes texture where the regime does.

Recurrence quantification is computed on the block revealed so far, with the main diagonal excluded: determinism is the share of recurrent points on diagonal lines of length two or more, laminarity the share on vertical lines. The chart is the histogram of diagonal line lengths.
