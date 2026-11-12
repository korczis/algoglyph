---
id: spreading-activation
title: Spreading activation
taxonomy: graphs/analysis
status: live
engine: graph
sources:
  - id: practice-systems
tags:
  - relevance
  - activation
  - weighted graphs
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: "O(E) per round"
interaction: "Tap a vertex to make it the seed."
related:
  - personalised-pagerank
---

Relevance flows from a seed along weighted edges and fades, choosing what to look at.

The circled seed fires a pulse of 1; vertices ringed in a round are about to fire, and size and colour show the activation gathered so far.

Raise the firing threshold and activation stops at fewer vertices after fewer rounds: the threshold is what keeps the computation local. At zero it runs until the pulses are negligible, and the activations equal (I − dW)⁻¹s, which the test harness checks against a linear solve.
