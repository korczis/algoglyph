---
id: foucault-pendulum
title: Foucault's Rosette
taxonomy: physics/mechanics
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: foucault-1851
    purpose: implementation
tags:
  - Coriolis
  - rotating frame
  - 3D
complexity: RK4, constant per step
interaction: Drag to orbit, scroll to zoom.
relations:
  - type: related_to
    target: charged-particles
    reason: The Coriolis force −2mΩ×v has the form of the magnetic force qv×B; neither does work, so both keep the energy, and Larmor's theorem is the same equivalence read the other way.
  - type: related_to
    target: double-pendulum
    reason: Both are pendulums stepped by classical RK4 at a fixed step; there two links make the motion chaotic, here one small swing turns under the Earth and RK4 keeps its energy and its angular momentum to 1e−8.
pedagogy:
  difficulty: intermediate
  objectives:
    - Measure the swing plane's turning and compare it with Ω sin φ at several latitudes.
    - See the half-swing shortened by the Earth's turning, from π/ω₀ to π/√(ω₀² + Ωz²).
    - Find the two quantities the rotating-frame equations keep, the energy and J = xy′ − yx′ + Ωz r², and watch them held.
  misconceptions:
    - The plane of swing is not pushed round by a force in space; in space it stays put while the floor turns, and in the floor's frame the Coriolis force turns it.
    - The turning is not the Earth's full rate everywhere; only the vertical component Ω sin φ turns the plane, so on the equator it does not turn.
    - The Coriolis force does not change the bob's energy, since it is always at right angles to its velocity.
  questions:
    - Why does a pendulum on the equator not turn, and one at the pole turn once a sidereal day?
    - What does the Earth's turning do to the time between turning points, and why so little?
    - Why is J, and not the bob's angular momentum in the floor's frame, kept?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - The swing is small, so the bob moves in the floor's plane under −ω₀²r and the Coriolis force −2Ωz ẑ×v; the horizontal component of Ω and the centrifugal force are neglected.
  invariants:
    - The energy ½|v|² + ½ω₀²r² and J = xy′ − yx′ + Ωz r² are kept by the equations; RK4 keeps them to its truncation, within 1e−8 over a measuring run.
  limitations:
    - The Earth is spun up a thousand to ten thousand times so the turning shows in seconds.
    - The turning points are found from 240 samples a second; their times are refined by a parabola through three samples.
bounds:
  model: RK4 steps of 1/240 s, four derivative evaluations each
  best: Θ(T/h)
  average: Θ(T/h)
  worst: Θ(T/h)
  space: Θ(trail) for the drawn track, O(1) for the state
experiments:
  - id: pole
    title: At the pole
    params: { lat: 90 }
    observe: The plane turns at the Earth's own rate, once a sidereal day on the real Earth.
  - id: equator
    title: On the equator
    params: { lat: 0 }
    observe: The plane does not turn at all; the vertical component of the Earth's rotation is zero.
  - id: southern
    title: In the southern hemisphere
    params: { lat: -33.9 }
    observe: The plane turns the other way, anticlockwise seen from above.
  - id: small-swing
    title: A small swing in Paris
    params: { amp: 0.05 }
    observe: Swinging at 0.05 rope lengths, the plane turns at Ω sin φ to within a hundredth of a per cent, and the turning points come every π/√(ω₀² + Ωz²).
  - id: fast-earth
    title: An Earth spun ten thousand times
    params: { boost: '10000', amp: 0.3 }
    observe: The plane turns at 0.549 rad/s, the half-swing is 1.174 s instead of 1.2 s, and the energy is still kept within 1e−9.
claims:
  - id: half-swing
    statement: >-
      In Paris the turning points come every π/√(ω₀² + Ωz²) of the rotating-frame equations, 1.197632 s, within 1e−7 s,
      each turning point's time refined by a parabola through three samples.
    readout: half-swing, measured between turning points (s)
    expect: { against: 'half-swing π/√(ω₀² + Ωz²) of the rotating-frame equations (s)', tolerance: 0.0000001 }
    setup:
      params: { runs: 1 }
  - id: half-swing-shortened
    statement: >-
      That is shorter than the half-swing π/ω₀ of a pendulum on a still Earth by more than 2e−3 s.
    readout: half-swing, measured between turning points (s)
    expect: { against: half-swing π/ω₀ without the Earth’s turning (s), below: -0.002 }
    setup:
      params: { runs: 1 }
  - id: pole-half-swing
    statement: >-
      At the pole, with Ωz the full Ω, it is π/√(ω₀² + Ω²) within 1e−7 s.
    readout: half-swing, measured between turning points (s)
    expect: { against: 'half-swing π/√(ω₀² + Ωz²) of the rotating-frame equations (s)', tolerance: 0.0000001 }
    setup:
      params: { lat: 90, amp: 0.05, runs: 1 }
  - id: energy-kept
    statement: >-
      (numerics) The Coriolis force does no work: RK4 keeps ½|v|² + ½ω₀²r² within 1e−8 of its start over the run.
    readout: energy ½|v|² + ½ω₀²r², largest relative change, numerics
    expect: { below: 0.00000001 }
    setup:
      params: { runs: 1 }
  - id: angular-momentum-kept
    statement: >-
      (numerics) The equations are the same after any turn about the vertical, so J = xy′ − yx′ + Ωz r² stays within
      1e−9 of ω₀a² of its start.
    readout: J = xy′ − yx′ + Ωz r², largest change over ω₀a², numerics
    expect: { below: 0.000000001 }
    setup:
      params: { runs: 1 }
  - id: precession-rate
    statement: >-
      Swinging at 0.05 rope lengths in Paris, its plane turns at Ω sin φ within 0.5 %, fitted over twenty
      swings; at this amplitude the elliptic swing's own (Airy) turning, about (3/8)a² of it, is under 0.1 %.
    readout: precession, measured
    expect: { against: 'precession, theory Ω·sin φ', tolerance: 0.8 }
    setup:
      params: { amp: 0.05, runs: 1 }
  - id: pole-rate
    statement: >-
      At the pole the plane turns at the full Ω, again within 0.5 %.
    readout: precession, measured
    expect: { against: 'precession, theory Ω·sin φ', tolerance: 1.1 }
    setup:
      params: { amp: 0.05, lat: 90, runs: 1 }
---

A pendulum in the Panthéon, with the Earth spun up a few thousand times: its swing plane turns under it and its shadow draws a rosette on the floor. Drag to orbit.

In 1851 Léon Foucault hung a 67 m pendulum in the Panthéon in Paris and showed that its plane of swing turns slowly, clockwise, because the floor rotates with the Earth beneath it. In the Earth's frame the turning is the Coriolis force, 2Ω × v.

This is the small-angle pendulum in the rotating frame, integrated with RK4. The plane precesses at Ω·sin(latitude): a full turn takes one sidereal day at a pole, about 32 hours in Paris, and never happens on the equator. The rotation is sped up so it is visible; the readout fits the precession rate from the swing's turning points and compares it with Ω·sin(latitude).

Released from rest relative to the floor, the bob traces a rosette with sharp cusps at its turning points. Move to the southern hemisphere and it turns the other way.

The equations keep two quantities, and the plate reads both. One is the energy ½|v|² + ½ω₀²r², kept because the Coriolis force is at right angles to the velocity. The other is J = xy′ − yx′ + Ωz r², the bob's angular momentum in a frame that does not turn, kept because the equations are the same after any turn about the vertical. Written for x + iy, the equations have two circular solutions turning at −Ωz ± √(ω₀² + Ωz²). The swing is their sum: a line turning at −Ωz, with its turning points π/√(ω₀² + Ωz²) apart. That spacing is slightly shorter than a still pendulum's π/ω₀, and the plate times it between turning points, each refined by a parabola through three samples. The plate takes no reader's data: its inputs are a latitude and a swing.
