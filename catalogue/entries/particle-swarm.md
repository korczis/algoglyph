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
---

Particles pulled towards their own best and the swarm's best positions.

Each velocity keeps an inertia of 0.7298 and is pulled towards the particle's own best point and the swarm's best point with random strengths up to 1.49618 each, the constriction-equivalent coefficients of Clerc and Kennedy; velocities are clamped to a fifth of the domain. Faint dots are the personal bests, the bright dot the swarm's best, the short strokes each particle's last move.

The swarm spread, the mean distance of the particles from their centroid, falls as the swarm agrees on a basin. Uniform random search with the same number of evaluations is the baseline in the chart.
