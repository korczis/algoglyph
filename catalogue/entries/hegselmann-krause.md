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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Simulate bounded confidence, every agent moving at once to the average opinion of those within ε of it.
    - Explain why the update never swaps two agents' order and why the opinions freeze into groups more than ε apart.
    - Relate the bound to the outcome, a single consensus for a wide ε and camps for a narrow one.
algorithm:
  paradigm: simulation
claims:
  - id: wide-bound-reaches-consensus
    statement: >-
      With the widest bound, ε = 0.5, the 120 agents reach a single consensus: one group.
    readout: Groups
    expect: { value: 1, tolerance: 0 }
    setup:
      params: { eps: 0.5 }
  - id: opinions-freeze-in-finitely-many-steps
    statement: >-
      At the default ε = 0.12 the opinions freeze before the plate's cap of 60 steps; the run stops
      before the cap only when no opinion moves any more.
    readout: Step
    expect: { below: 60 }
  - id: narrow-bound-leaves-fewer-camps-than-one-per-2-eps
    statement: >-
      At the default ε = 0.12, 120 agents spread over [0, 1] freeze into fewer groups, stragglers
      included, than one group per 2ε of the spread would give: fewer than 1/(2ε) ≈ 4.17.
    readout: Groups
    expect: { below: 4.17 }
---

Agents average only with those close enough to them; consensus or camps depending on the bound.

Every step every agent moves at once to the average opinion of the agents within ε of it, itself included. With the opinions sorted those neighbours are a contiguous window, so the averages come from prefix sums. The update never swaps two agents' order, and after finitely many steps the opinions freeze into groups more than ε apart.

A wide bound reaches a single consensus; a narrow one leaves camps, somewhat fewer than one for every 2ε of the initial spread even when the stragglers sometimes stranded between them are counted as groups. Lines are coloured by each agent's starting opinion.
