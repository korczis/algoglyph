---
id: lyapunov-exponent
title: Largest Lyapunov exponent
taxonomy: dynamics/chaos
status: live
engine: numeric
sources:
  - id: practice-decisions
tags:
  - lyapunov
  - divergence
  - chaos
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'linear in the integration time; the estimate converges slowly, like a mean'
related:
  - poincare-section
  - takens-embedding
---

Two nearby trajectories, their separation renormalised and averaged into a growth rate.

A reference orbit and a neighbour 10⁻⁸ away are advanced together. After each interval their separation is measured, its logarithmic growth added up, and the neighbour pulled back to the original distance along the same direction, so the pair keeps sampling the fastest-growing direction without leaving the linear regime.

The running mean converges towards the exponent: ln 2 for the logistic map at r = 4, which the test checks, and published values of about 0.906 for the Lorenz flow and 0.419 for the Hénon map. At r = 3.5 the orbit is a stable 4-cycle and the exponent is negative.
