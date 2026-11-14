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
claims:
  - id: annealing-settles-on-himmelblau
    statement: >-
      On Himmelblau's function, whose four equal minima are 0, 2,400 evaluations cooled to 0.001 of
      the first temperature end within 0.00955 of the minimum at every seed of the fixed seed set
      1–5. The bound is not this set's reading and assumes no shape for the gap: on the disjoint
      seeds 101–400, fixed before they were run, the largest printed gap is 0.0095, and 0.00005 of
      display rounding gives 0.00955. A new seed exceeds the maximum of 300 exchangeable draws with
      probability at most 1/301, so all five stay under it with probability at least 1 − 5/301. On
      Rastrigin no such claim is made: there the final gap is bimodal, the walk often freezing in a
      neighbouring basin.
    readout: Gap to the known minimum
    expect: { below: 0.00955 }
    setup:
      params: { landscape: himmelblau, budget: 2400, cooling: 0.001 }
      seeds: [1, 2, 3, 4, 5]
---

Accept worse moves with a probability that cools, to escape local optima.

The first temperature is the standard deviation of the objective over a few random points, so the walk starts able to cross the landscape's ridges; it then cools geometrically to the chosen fraction of that value, and the Gaussian step size shrinks with the square root of the temperature. The acceptance rate and the number of uphill moves taken are counted as the run goes.

Uniform random search runs beside it with exactly the same number of evaluations (its own, not counted in the Evaluations readout), and the chart puts both best-so-far curves on one axis. On Rastrigin's egg box a walk that cools too fast freezes in the first basin it finds; a slower schedule spends its budget hopping between basins first.

On Himmelblau's function the gap left at the end has a heavier tail than a normal one. Every basin floors at 0, so the walk cannot settle in a worse one: the gap is how far above the floor of its basin the best point still was when the run ended. On the 300 seeds 101–400 it is usually tiny, median 0.0008 and 90th percentile 0.0026, but now and then a run ends further up a basin's wall; the largest gap is 0.0095. The mean plus three standard deviations of those 300 is 0.0050, and seven of them lie above it, where a normal tail would put about 0.4. So mean + 3·SD understates the tail: a band fitted that way on the first 30 of those seeds, 0.0048, is exceeded by seed 5 of the claim's own seed set, at 0.0055. The claim's bound is therefore the largest gap of the 300, which asks nothing of the gap's shape.
