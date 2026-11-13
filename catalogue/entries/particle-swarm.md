---
id: particle-swarm
title: Particle swarm optimisation
taxonomy: numerics/optimisation
status: live
engine: stochastic
labs:
  - stochastic-search
sources:
  - id: practice-decisions
tags:
  - optimisation
  - swarm
complexity: "swarm size evaluations per iteration"
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
claims:
  - id: swarm-reaches-the-minimum-rastrigin-seed-1
    statement: >-
      With 2,400 evaluations and 24 particles the swarm finds the global minimum 0 of Rastrigin's
      egg box: the gap printed to four decimals is 0.0000, so below 10⁻⁴ (the true gap below 5 ·
      10⁻⁵), on seed 1 of the fixed seed set 1–3.
    readout: Gap to the known minimum
    expect: { below: 0.0001 }
    setup:
      params: { landscape: rastrigin, budget: 2400, swarm: 24 }
      seed: 1
  - id: swarm-reaches-the-minimum-rastrigin-seed-2
    statement: >-
      With 2,400 evaluations and 24 particles the swarm finds the global minimum 0 of Rastrigin's
      egg box: the gap printed to four decimals is 0.0000, so below 10⁻⁴ (the true gap below 5 ·
      10⁻⁵), on seed 2 of the fixed seed set 1–3.
    readout: Gap to the known minimum
    expect: { below: 0.0001 }
    setup:
      params: { landscape: rastrigin, budget: 2400, swarm: 24 }
      seed: 2
  - id: swarm-reaches-the-minimum-rastrigin-seed-3
    statement: >-
      With 2,400 evaluations and 24 particles the swarm finds the global minimum 0 of Rastrigin's
      egg box: the gap printed to four decimals is 0.0000, so below 10⁻⁴ (the true gap below 5 ·
      10⁻⁵), on seed 3 of the fixed seed set 1–3.
    readout: Gap to the known minimum
    expect: { below: 0.0001 }
    setup:
      params: { landscape: rastrigin, budget: 2400, swarm: 24 }
      seed: 3
  - id: swarm-reaches-the-minimum-ackley-seed-1
    statement: >-
      With 2,400 evaluations and 24 particles the swarm finds the global minimum 0 of Ackley's
      funnel: the gap printed to four decimals is 0.0000, so below 10⁻⁴ (the true gap below 5 ·
      10⁻⁵), on seed 1 of the fixed seed set 1–3.
    readout: Gap to the known minimum
    expect: { below: 0.0001 }
    setup:
      params: { landscape: ackley, budget: 2400, swarm: 24 }
      seed: 1
  - id: swarm-reaches-the-minimum-ackley-seed-2
    statement: >-
      With 2,400 evaluations and 24 particles the swarm finds the global minimum 0 of Ackley's
      funnel: the gap printed to four decimals is 0.0000, so below 10⁻⁴ (the true gap below 5 ·
      10⁻⁵), on seed 2 of the fixed seed set 1–3.
    readout: Gap to the known minimum
    expect: { below: 0.0001 }
    setup:
      params: { landscape: ackley, budget: 2400, swarm: 24 }
      seed: 2
  - id: swarm-reaches-the-minimum-ackley-seed-3
    statement: >-
      With 2,400 evaluations and 24 particles the swarm finds the global minimum 0 of Ackley's
      funnel: the gap printed to four decimals is 0.0000, so below 10⁻⁴ (the true gap below 5 ·
      10⁻⁵), on seed 3 of the fixed seed set 1–3.
    readout: Gap to the known minimum
    expect: { below: 0.0001 }
    setup:
      params: { landscape: ackley, budget: 2400, swarm: 24 }
      seed: 3
---

Particles pulled towards their own best and the swarm's best positions.

Each velocity keeps an inertia of 0.7298 and is pulled towards the particle's own best point and the swarm's best point with random strengths up to 1.49618 each, the constriction-equivalent coefficients of Clerc and Kennedy; velocities are clamped to a fifth of the domain. Faint dots are the personal bests, the bright dot the swarm's best, the short strokes each particle's last move.

The swarm spread, the mean distance of the particles from their centroid, falls as the swarm agrees on a basin. Uniform random search with the same number of evaluations is the baseline in the chart.
