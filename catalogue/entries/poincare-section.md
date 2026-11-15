---
id: poincare-section
title: Poincaré section
taxonomy: dynamics/chaos
status: live
engine: numeric
sources:
  - id: practice-decisions
  - id: henon-heiles-1964
    purpose: algorithm-reference
tags:
  - poincare
  - maps
  - orbits
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
complexity: 'linear in the integration time'
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Turn a flow into a map by keeping each upward crossing of x = 0, located by linear interpolation between steps, as a point (y, py).
    - Tell regular orbits, which lie on invariant tori and pierce the plane along closed curves, from chaotic ones that fill a region of their own.
    - Raise the energy towards the escape value and watch the islands dissolve into the chaotic sea.
    - Read the energy error of the symplectic leapfrog, which stays bounded instead of drifting.
  misconceptions:
    - A symplectic integrator does not conserve the energy exactly; its error stays bounded instead of drifting, which the readout measures.
algorithm:
  paradigm: numerical-integration
claims:
  - id: every-bound-orbit-crosses-at-the-top-energy
    statement: >-
      At energy 0.165, below the escape energy 1/6, every orbit stays inside the bounded part of
      the potential and keeps crossing the plane, so each of the 16 orbits makes all 160
      crossings: exactly 16 × 160 = 2,560 section points.
    readout: Section points
    expect: { value: 2560 }
    setup:
      params: { energy: 0.165 }
  - id: drift-within-the-leapfrog-error
    statement: >-
      The leapfrog's energy error on an oscillation of frequency ω stays within about h²ω²/4 of
      the energy; the potential's curvature 1 ± 2λρ reaches at most 3 inside the bounded region
      (ρ ≤ 1/λ, the saddles), so with h = 0.01 the largest relative drift stays below
      0.0001 × 3/4 = 7.5e-5 at energy 0.165.
    readout: Largest relative energy drift
    expect: { below: 7.5e-5 }
    setup:
      params: { energy: 0.165 }
  - id: drift-within-the-leapfrog-error-at-the-default
    statement: >-
      The same bound, h²ω²/4 with ω² ≤ 3, holds at the default energy 0.125: the largest
      relative drift over every step of the 16 orbits stays below 7.5e-5.
    readout: Largest relative energy drift
    expect: { below: 7.5e-5 }
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

Orbits of the Hénon–Heiles system, all with the same energy, are integrated with the leapfrog scheme of the shared integrator library, which is symplectic: the energy error stays bounded instead of drifting, and the readout measures it. Each upward crossing of x = 0 is located by linear interpolation between steps.

Regular orbits lie on invariant tori and pierce the plane along closed curves, the islands; chaotic orbits fill a region of their own. Raising the energy towards the escape value, 1/(6λ²) for the coupling λ and so 1/6 at the default λ = 1, dissolves the islands into the chaotic sea; at λ = 0 the two oscillators are uncoupled and every orbit is regular. The outer curve is where the section meets the energy surface.
