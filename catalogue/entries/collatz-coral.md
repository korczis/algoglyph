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
claims:
  - id: twenty-seven-takes-111-steps
    statement: >-
      27 is the smallest start whose orbit is long and high: it takes 111 steps to reach 1, and
      climbs to 9,232 on the way. The plate counts the orbit with the same iteration that draws
      the coral; an independent loop in arbitrary-precision integers gives 111, as does OEIS
      A006577.
    readout: steps from the chosen start
    expect: { value: 111 }
    setup:
      params: { start: 27 }
  - id: record-below-100000
    statement: >-
      77,031 has the longest orbit of any start below 100,000, 350 steps (OEIS A006877), which a
      sample of 6,000 random starts usually misses; counted from the start control, it is exactly
      350, as an independent loop gives.
    readout: steps from the chosen start
    expect: { value: 350 }
    setup:
      params: { start: 77031 }
---

Thousands of Collatz orbits drawn backwards from 1, bending one way on even steps and the other on odd: shared tails fuse into coral.

Halve an even number, triple an odd one and add one; every number tried so far reaches 1. Each orbit is reversed so it starts at 1 at the bottom and is drawn as a turtle walk: turn one way after an even value, the other way after an odd value, step forward.

Orbits that share a tail share their first strokes, so common routes thicken into trunks. Colour follows the orbit's length (its total stopping time), short to long.

Starting values are sampled from the seed within the chosen range; the readout reports the longest orbit actually drawn. A second readout counts the steps from one start value of the reader's choosing, 27 by default, without changing the picture.
