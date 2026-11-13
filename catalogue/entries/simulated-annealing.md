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
  - id: annealing-settles-on-himmelblau-seed-1
    statement: >-
      On Himmelblau's function, whose four equal minima are 0, 2,400 evaluations cooled to 0.001 of
      the first temperature end within 0.00481 of the minimum on seed 1 of the fixed seed set 1–3.
      The bound is not this set's reading: on the disjoint seeds 101–130, fixed before they were
      run, the printed gap has mean 0.00116 and standard deviation 0.00120 (largest 0.0042), and
      mean + 3 SD = 0.00476, plus 0.00005 of display rounding, gives 0.00481; random search with as
      many evaluations ends at a median gap of 0.051 on those seeds. On Rastrigin no such claim is
      made: there the final gap is bimodal, the walk often freezing in a neighbouring basin.
    readout: Gap to the known minimum
    expect: { below: 0.00481 }
    setup:
      params: { landscape: himmelblau, budget: 2400, cooling: 0.001 }
      seed: 1
  - id: annealing-settles-on-himmelblau-seed-2
    statement: >-
      On Himmelblau's function, whose four equal minima are 0, 2,400 evaluations cooled to 0.001 of
      the first temperature end within 0.00481 of the minimum on seed 2 of the fixed seed set 1–3.
      The bound is not this set's reading: on the disjoint seeds 101–130, fixed before they were
      run, the printed gap has mean 0.00116 and standard deviation 0.00120 (largest 0.0042), and
      mean + 3 SD = 0.00476, plus 0.00005 of display rounding, gives 0.00481; random search with as
      many evaluations ends at a median gap of 0.051 on those seeds. On Rastrigin no such claim is
      made: there the final gap is bimodal, the walk often freezing in a neighbouring basin.
    readout: Gap to the known minimum
    expect: { below: 0.00481 }
    setup:
      params: { landscape: himmelblau, budget: 2400, cooling: 0.001 }
      seed: 2
  - id: annealing-settles-on-himmelblau-seed-3
    statement: >-
      On Himmelblau's function, whose four equal minima are 0, 2,400 evaluations cooled to 0.001 of
      the first temperature end within 0.00481 of the minimum on seed 3 of the fixed seed set 1–3.
      The bound is not this set's reading: on the disjoint seeds 101–130, fixed before they were
      run, the printed gap has mean 0.00116 and standard deviation 0.00120 (largest 0.0042), and
      mean + 3 SD = 0.00476, plus 0.00005 of display rounding, gives 0.00481; random search with as
      many evaluations ends at a median gap of 0.051 on those seeds. On Rastrigin no such claim is
      made: there the final gap is bimodal, the walk often freezing in a neighbouring basin.
    readout: Gap to the known minimum
    expect: { below: 0.00481 }
    setup:
      params: { landscape: himmelblau, budget: 2400, cooling: 0.001 }
      seed: 3
---

Accept worse moves with a probability that cools, to escape local optima.

The first temperature is the standard deviation of the objective over a few random points, so the walk starts able to cross the landscape's ridges; it then cools geometrically to the chosen fraction of that value, and the Gaussian step size shrinks with the square root of the temperature. The acceptance rate and the number of uphill moves taken are counted as the run goes.

Uniform random search runs beside it with exactly the same number of evaluations (its own, not counted in the Evaluations readout), and the chart puts both best-so-far curves on one axis. On Rastrigin's egg box a walk that cools too fast freezes in the first basin it finds; a slower schedule spends its budget hopping between basins first.
