---
id: sir-cascade
title: A story spreading through a network
taxonomy: inference/opinion
status: live
engine: graph
sources:
  - id: practice-investigation
tags:
  - sir
  - cascades
  - networks
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(E) per step"
interaction: "Tap a vertex to make it the seed."
related:
  - spreading-activation
relations:
  - { type: generalizes, target: breadth-first-search, reason: "With beta and gamma both 1 the cascade is exactly a breadth-first search." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites:
  - breadth-first-search
  objectives:
  - Read susceptible, spreading and recovered vertices and the transmissions between them.
  - See that with beta and gamma both 1 the cascade is a breadth-first search, one hop per step.
  - Watch a lower beta or a higher gamma end the cascade sooner, its reach varying by seed.
algorithm:
  paradigm: simulation
claims:
  - id: certain-spread-reaches-everyone
    statement: >-
      With beta and gamma both 1 the cascade is a breadth-first search, so it reaches every vertex
      of the seed's component: all 160 of the connected small-world graph, as a separate
      breadth-first search of the same graph confirms.
    readout: Final reach
    expect: { value: 160 }
    setup:
      params: { beta: 1, gamma: 1 }
  - id: certain-spread-moves-one-hop-per-step
    statement: >-
      With beta and gamma both 1 the cascade moves one hop per step: it takes the seed vertex's
      eccentricity, 10 in seed 4242's graph by a separate breadth-first search, plus one last
      round in which the farthest vertices find nobody new, so 11 rounds.
    readout: Rounds
    expect: { value: 11 }
    setup:
      params: { beta: 1, gamma: 1 }
---

Susceptible, infected and recovered vertices: how far a narrative reaches.

Hollow vertices are susceptible, ringed ones spreading, filled ones recovered; thick edges are the transmissions. The chart tracks the three counts per step.

With beta and gamma both 1 the cascade is exactly a breadth-first search, one hop per step. Lower beta or raise gamma and it dies out sooner; the final reach varies from seed to seed.
