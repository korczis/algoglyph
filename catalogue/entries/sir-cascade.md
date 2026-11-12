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
  - breadth-first-search
---

Susceptible, infected and recovered vertices: how far a narrative reaches.

Hollow vertices are susceptible, ringed ones spreading, filled ones recovered; thick edges are the transmissions. The chart tracks the three counts per step.

With beta and gamma both 1 the cascade is exactly a breadth-first search, one hop per step. Lower beta or raise gamma and it dies out sooner; the final reach varies from seed to seed.
