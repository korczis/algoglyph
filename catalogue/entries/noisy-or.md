---
id: noisy-or
title: Noisy-OR evidence fusion
taxonomy: inference/belief
status: live
engine: stochastic
sources:
  - id: practice-entity-resolution
tags:
  - noisy-or
  - evidence fusion
complexity: "linear in the number of causes"
motivation: Resolving one company or person across noisy public registries needs it.
---

Independent pieces of evidence combine as one minus the product of their failures.

The waterfall adds the present causes one at a time: each raises the probability of the effect by its link probability times what is still missing, q ← q + (1 − q)p, which is the same number as one minus the product of all the failures. Absent causes contribute nothing.

The Monte Carlo run simulates the generative story behind the formula: the leak and every present cause fire independently, and the effect occurs when any of them does. Its frequency converges on the noisy-OR value at the rate of a binomial proportion, shown as a ±2 standard-error band.
