---
id: poincare-section
title: Poincaré section
taxonomy: dynamics/chaos
status: live
engine: numeric
sources:
  - id: practice-decisions
tags:
  - poincare
  - maps
  - orbits
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'linear in the integration time'
related:
  - lyapunov-exponent
---

Where a trajectory pierces a plane, turning a flow into a map.

Orbits of the Hénon–Heiles system, all with the same energy, are integrated with the leapfrog scheme, which is symplectic: the energy error stays bounded instead of drifting, and the readout measures it. Each upward crossing of x = 0 is located by linear interpolation between steps.

Regular orbits lie on invariant tori and pierce the plane along closed curves, the islands; chaotic orbits fill a region of their own. Raising the energy towards the escape value of 1/6 dissolves the islands into the chaotic sea. The outer curve is where the section meets the energy surface.
