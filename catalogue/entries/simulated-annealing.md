---
id: simulated-annealing
title: Simulated annealing
taxonomy: numerics/optimisation
status: live
engine: stochastic
labs:
  - stochastic-search
sources:
  - id: practice-decisions
tags:
  - optimisation
  - annealing
  - metropolis
complexity: "one objective evaluation per proposal"
related:
  - particle-swarm
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
---

Accept worse moves with a probability that cools, to escape local optima.

The first temperature is the standard deviation of the objective over a few random points, so the walk starts able to cross the landscape's ridges; it then cools geometrically to the chosen fraction of that value, and the Gaussian step size shrinks with the square root of the temperature. The acceptance rate and the number of uphill moves taken are counted as the run goes.

Uniform random search runs beside it with exactly the same number of evaluations, and the chart puts both best-so-far curves on one axis. On Rastrigin's egg box a walk that cools too fast freezes in the first basin it finds; a slower schedule spends its budget hopping between basins first.
