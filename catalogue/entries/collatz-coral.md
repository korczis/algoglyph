---
id: collatz-coral
title: Collatz Coral
taxonomy: numerics/number-theory
status: live
engine: custom
tags:
  - number theory
  - turtle graphics
  - conjecture
complexity: O(Σ stopping times)
---

Thousands of Collatz orbits drawn backwards from 1, bending one way on even steps and the other on odd: shared tails fuse into coral.

Halve an even number, triple an odd one and add one; every number tried so far reaches 1. Each orbit is reversed so it starts at 1 at the bottom and is drawn as a turtle walk: turn one way after an even value, the other way after an odd value, step forward.

Orbits that share a tail share their first strokes, so common routes thicken into trunks. Colour follows the orbit's length (its total stopping time), short to long.

Starting values are sampled from the seed within the chosen range; the readout reports the longest orbit actually drawn.
