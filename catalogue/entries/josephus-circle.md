---
id: josephus-circle
title: Josephus problem
taxonomy: foundations/structures
status: live
engine: custom
sources:
  - id: sedgewick-aic
    ref: "Part 2: Data Structures"
tags:
  - linked list
  - circular
complexity: '(N − 1)(M − 1) link steps and N − 1 removals'
related:
  - circular-queue
---

People in a circle, every M-th one leaves, on a circular linked list until one is left.

The people are nodes of a circular singly linked list kept in an array of next indices. Counting follows M − 1 links; removing the M-th person is one relink of its predecessor, so the whole elimination follows (N − 1)(M − 1) links and makes N − 1 removals.

Chords join each person removed to the next one removed, coloured from first to last, and the ring marks the person the count stands on. For M = 2 the survivor has a closed form: write N = 2ᵃ + L with L < 2ᵃ, and person 2L + 1 survives. The tests check the simulation against that formula and, for other M, against a brute-force array simulation.
