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
claims:
  - id: uncoupled-orbits-all-cross
    statement: >-
      With the coupling λ at 0 the system is two uncoupled unit oscillators: x is a harmonic
      oscillator started at x = 0 with px > 0, so it crosses x = 0 upwards once every period 2π,
      and each of the 16 orbits makes all 160 crossings even at energy 0.165: exactly 2,560
      section points.
    readout: Section points
    expect: { value: 2560 }
    setup:
      params: { lambda: 0, energy: 0.165 }
  - id: uncoupled-drift-within-the-modified-energy
    statement: >-
      At λ 0 the leapfrog conserves the modified energy H̃ = H − (h²/8)(x² + y²) of each
      oscillator exactly, so |H − H0| ≤ (h²/8)·max(x² + y²) and the relative drift stays within
      (h²/4)/(1 − h²/4) = 2.50006e-5 for h = 0.01; printed to three digits that is at most
      2.50e-5.
    readout: Largest relative energy drift
    expect: { range: [0, 2.5e-5] }
    setup:
      params: { lambda: 0, energy: 0.165 }
  - id: half-coupling-orbits-all-cross
    statement: >-
      At λ 0.5 the scaling x = X/λ makes the energy 0.165 the scaled energy λ²E = 0.041, a
      quarter of the escape energy 1/6, so every orbit stays bound and makes all 160 crossings:
      exactly 2,560 section points.
    readout: Section points
    expect: { value: 2560 }
    setup:
      params: { lambda: 0.5, energy: 0.165 }
  - id: escape-energy-at-half-coupling
    statement: >-
      The escape energy is 1/(6λ²): at λ 0.5 it is 2/3, which the readout prints to four
      significant digits as 0.6667, within its rounding of 0.00005.
    readout: Escape energy 1/(6λ²)
    expect: { value: 0.6667, tolerance: 0.00005 }
    setup:
      params: { lambda: 0.5 }
---

Where a trajectory pierces a plane, turning a flow into a map.

Orbits of the Hénon–Heiles system, all with the same energy, are integrated with the leapfrog scheme, which is symplectic: the energy error stays bounded instead of drifting, and the readout measures it. Each upward crossing of x = 0 is located by linear interpolation between steps.

Regular orbits lie on invariant tori and pierce the plane along closed curves, the islands; chaotic orbits fill a region of their own. Raising the energy towards the escape value, 1/(6λ²) for the coupling λ and so 1/6 at the default λ = 1, dissolves the islands into the chaotic sea; at λ = 0 the two oscillators are uncoupled and every orbit is regular. The outer curve is where the section meets the energy surface.
