---
id: pick-path-routing
title: Warehouse pick-path routing
taxonomy: numerics/optimisation
status: live
engine: geometry
sources:
  - id: practice-logistics
tags:
  - routing
  - tsp
  - warehouses
motivation: Warehouse logistics spend most of their time on exactly this.
complexity: "S-shape and largest gap O(n log n); the optimal tour O(2ⁿ n²) by dynamic programming over subsets"
related:
  - simple-closed-path
claims:
  - id: held-karp-states-10
    statement: >-
      Held and Karp's programme keeps one state per subset S of the picks and pick j in S that ends
      a path through S; every one is reachable, so there are Σ |S| = m · 2^(m − 1) of them, exactly
      10 · 512 = 5,120 for 10 picks.
    readout: Dynamic-programme states
    expect: { value: 5120 }
    setup:
      params: { n: 10, aisles: 8 }
  - id: held-karp-states-12
    statement: >-
      For 12 picks, the control's top, the states number exactly 12 · 2¹¹ = 24,576: the
      exponential growth that keeps the exact route to short lists.
    readout: Dynamic-programme states
    expect: { value: 24576 }
    setup:
      params: { n: 12, aisles: 8 }
  - id: s-shape-is-no-shorter-than-optimal
    statement: >-
      The S-shape route visits every pick and returns, so it is a tour and cannot be shorter than
      the optimal one: its printed length minus the optimal length is at least 0 (both are rounded
      to whole units, which keeps the order), on seed 4242's list of 10 picks in 8 aisles.
    readout: S-shape
    expect: { against: Optimal, above: -0.5 }
    setup:
      params: { n: 10, aisles: 8 }
  - id: largest-gap-is-no-shorter-than-optimal
    statement: >-
      The largest-gap route is a tour too, so its printed length is at least the optimal one on the
      same list.
    readout: Largest gap
    expect: { against: Optimal, above: -0.5 }
    setup:
      params: { n: 10, aisles: 8 }
---

S-shape, largest-gap and optimal routes through the same picking list, and their walking distances.

The warehouse has one block of parallel aisles between a front and a back cross aisle, and the depot at the front of the first aisle. S-shape walks every aisle that holds a pick end to end, alternating direction, and enters a last odd aisle from the front and leaves it the same way. Largest gap walks the first and last such aisles end to end and enters every aisle between from the back down to its largest gap between picks, then from the front up to it, so that gap is never walked.

The optimal tour comes from Held and Karp's dynamic programme over subsets of the pick list, on the shortest walk between every two locations; exact, but exponential in the list length, which is why the list is short. Polynomial exact methods exist for this single-block layout (Ratliff and Rosenthal) and are not used here. The chart runs all three on the first m picks of the same list and plots each route's measured length.
