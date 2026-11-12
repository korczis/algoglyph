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
---

S-shape, largest-gap and optimal routes through the same picking list, and their walking distances.

The warehouse has one block of parallel aisles between a front and a back cross aisle, and the depot at the front of the first aisle. S-shape walks every aisle that holds a pick end to end, alternating direction, and enters a last odd aisle from the front and leaves it the same way. Largest gap walks the first and last such aisles end to end and enters every aisle between from the back down to its largest gap between picks, then from the front up to it, so that gap is never walked.

The optimal tour comes from Held and Karp's dynamic programme over subsets of the pick list, on the shortest walk between every two locations; exact, but exponential in the list length, which is why the list is short. Polynomial exact methods exist for this single-block layout (Ratliff and Rosenthal) and are not used here. The chart runs all three on the first m picks of the same list and plots each route's measured length.
