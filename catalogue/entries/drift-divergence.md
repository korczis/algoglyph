---
id: drift-divergence
title: "Distribution drift: PSI, KL and Jensen–Shannon"
taxonomy: dynamics/change
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - drift
  - divergence
  - psi
complexity: "linear in the samples per window, then linear in the bins"
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
---

Two histograms pulling apart, measured three ways.

Both windows are binned on the same edges, and half a count is added to every bin so that no proportion is zero and every logarithm is defined. The population stability index Σ(q − p) ln(q/p) is exactly the sum of the two Kullback–Leibler divergences, KL(q‖p) + KL(p‖q); the Jensen–Shannon divergence compares both with their average and, in bits, lies between 0 and 1.

With no drift the divergences stay near zero but not at it: two samples of one distribution differ by sampling noise, and more samples per window lower that floor. The customary PSI rules of thumb, 0.1 to watch and 0.25 to act, are conventions of practice, not statistical tests.
