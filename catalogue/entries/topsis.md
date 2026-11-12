---
id: topsis
title: TOPSIS
taxonomy: inference/multi-criteria
status: live
engine: numeric
sources:
  - id: practice-decisions
tags:
  - multi-criteria
  - ideal point
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'O(m k) for m options and k criteria'
related:
  - pareto-front
---

Options ranked by closeness to the ideal and distance from the anti-ideal.

Each criterion is divided by its Euclidean norm, so units do not matter, then weighted. The ideal takes the best weighted value of every criterion and the anti-ideal the worst; each option's closeness is D− / (D+ + D−), its distance from the anti-ideal over the sum of both distances.

The right panel plots D+ against D− with lines of equal closeness. The chart repeats the whole computation as the weight of the first criterion moves, which shows where the ranking flips: the answer depends on weights that someone has to choose.
