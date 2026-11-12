---
id: hegselmann-krause
title: Bounded-confidence opinion dynamics
taxonomy: inference/opinion
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - opinion dynamics
  - polarisation
complexity: "n log n per step with the opinions sorted"
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
---

Agents average only with those close enough to them; consensus or camps depending on the bound.

Every step every agent moves at once to the average opinion of the agents within ε of it, itself included. With the opinions sorted those neighbours are a contiguous window, so the averages come from prefix sums. The update never swaps two agents' order, and after finitely many steps the opinions freeze into groups more than ε apart.

A wide bound reaches a single consensus; a narrow one leaves camps, roughly one for every 2ε of the initial spread, with stragglers sometimes stranded between them. Lines are coloured by each agent's starting opinion.
