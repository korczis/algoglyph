---
id: beam
title: Bending and Buckling Beam
taxonomy: physics/mechanics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - cantilever
  - Euler-Bernoulli beam
  - elastica
  - Euler buckling
  - Hencky bar chain
sources:
  - id: feynman-lectures
    ref: 'Vol. II, ch. 38 (elasticity: the bending of a bar, the buckling of a column)'
    purpose: further-reading
  - id: euler-1744
    ref: 'Additamentum I, De curvis elasticis: the elastica and the load at which a column first bends'
    purpose: implementation
  - id: timoshenko-gere-1961
    ref: 'Chapter 2: buckling of bars, Euler''s load for the four ends, and the large deflections of the elastica in elliptic integrals'
    purpose: implementation
  - id: hencky-1920
    purpose: implementation
tags:
  - elasticity
  - bending
  - buckling
  - elastica
  - bifurcation
  - Newton's method
  - tridiagonal
  - elliptic integral
  - shooting method
complexity: O(N) per Newton step on the tridiagonal Hessian; a few steps per load step, 400 load steps a run
interaction: Choose the load, a force at the tip, the beam's own weight or a push along its axis, and how large it is; how many cells the chain has; for the column, the nudge that picks the side it buckles to. The load rises step by step and the panel draws load against deflection.
motivation: A thin beam bends by FL³/3EI under a small load at its end, and a column under a push along its axis stays straight until the push reaches π²EI/4L², then bends sideways by a finite amount; a chain of rigid links and springs, bent as far as the load takes it, reaches both and the large deflections beyond them.
relations:
  - type: related_to
    target: roots-and-logarithms
    reason: Each load step is Newton's method; there on one equation, where it doubles the digits each step, here on the chain's N equations of balance, each step one solve of a tridiagonal system.
  - type: related_to
    target: constrained-motion
    reason: The bead on a circle reaches the bottom after √(L/g)·K(sin(θ₀/2)); the buckled column obeys λL = K(sin(α/2)), the same equation with arc length for time and the column's lean for the pendulum's swing, Kirchhoff's analogy.
  - type: related_to
    target: least-action
    reason: Both find a curve by making a functional stationary; there the action of a path in time, here the potential energy of a bent beam, its springs' energy less the load's work.
pedagogy:
  difficulty: intermediate
  objectives:
    - Load a cantilever lightly at its tip and measure that its tip falls by FL³/3EI, and under its own weight by qL⁴/8EI.
    - Load it heavily and see the deflection fall short of the linear beam's as the beam turns towards the load and shortens its lever arm.
    - Find the chain's buckling load from the signs of its Hessian's pivots and compare it with Euler's π²EI/4L².
    - Push a column past Euler's load and measure its sideways bend against the elastica's 2k/λ, with λL = K(k).
  misconceptions:
    - A column does not bend a little at every load; below Euler's load it stays straight, and the bend appears only above it.
    - Euler's load is not where a column breaks; past it the column still carries the load, bent, and the bend grows quickly with the load.
    - The deflection FL³/3EI is not the deflection at any load; it holds only while the tip's angle is small.
    - Buckling is not a weakness of the material but of the shape; the same material as a shorter column carries four times the load at half the length.
  questions:
    - Why does a heavy tip load deflect the beam less than FL³/3EI says?
    - Why does a column under 0.9 of Euler's load bend only by an amount proportional to its nudge?
    - How much larger must the push be to bend the column's tip sideways by half its length?
    - Why does the chain's buckling load lie below Euler's, and how fast does it approach it as the cells are halved?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - The beam has length L = 1 and bending stiffness EI = 1; it is inextensible and its sections stay perpendicular to it.
    - The base is clamped; the tip is free, with the load at it, along it or spread over the cells.
  invariants:
    - The springs' energy less the load's work is minimised at every load step; Newton's step is shifted until its Hessian is positive definite, so each step goes downhill.
    - The Hessian is tridiagonal, because a load's work depends on each segment's angle only through the forces beyond it.
  limitations:
    - No shear deformation, no stretching of the axis and no material yield; the beam bends elastically however far it goes.
    - The chain's error falls as 1/N² against the continuous beam; at 40 cells it is about 1.6e−4 of the deflection.
    - The load rises in 400 equal steps and each starts from the last; a column above Euler's load needs its nudge to leave the straight state.
bounds:
  model: Newton steps on the chain of N cells, each an O(N) tridiagonal solve and line search
  best: Θ(N) per load step
  average: Θ(N) per load step, two or three Newton steps each
  worst: Θ(N) per Newton step, at most 200 a load step
  space: Θ(N)
experiments:
  - id: small-tip-load
    title: A light load at the tip
    params: { load: tip, force: 0.01 }
    observe: The tip falls by 0.003333 L, FL³/3EI, and the load–deflection line is straight.
  - id: large-tip-load
    title: A heavy load at the tip
    params: { load: tip, force: 2 }
    observe: The tip falls by 0.493 L, not the linear beam's 0.667 L; the beam has turned towards the load and its lever arm has shortened.
  - id: hanging-tip
    title: Almost hanging
    params: { load: tip, force: 20 }
    observe: At FL²/EI = 20 the tip points almost straight down and the beam's end lies within a third of L of the wall.
  - id: own-weight
    title: Under its own weight
    params: { load: weight, weight: 0.01 }
    observe: The tip falls by qL⁴/8EI, less than under the same weight at the tip, because the weight acts nearer the clamp.
  - id: below-euler
    title: Below Euler's load
    params: { load: column, ratio: 0.9 }
    observe: The column stays straight; its tip moves sideways by about seven times its nudge, tan(λL)/λL − 1 of the linear column.
  - id: past-euler
    title: Past Euler's load
    params: { load: column, ratio: 1.5 }
    observe: At one and a half times Euler's load the tip has moved sideways by 0.79 L and come down to 0.36 L above the ground.
  - id: looped-column
    title: Four times Euler's load
    params: { load: column, ratio: 4 }
    observe: The tip has passed below its clamp; the elastica bends through more than 150°.
  - id: coarse-chain
    title: Eight cells
    params: { load: tip, force: 0.01, cells: 8 }
    observe: The coarse chain falls short of FL³/3EI by about 0.4 per cent, 1/(4N²); halving the cells quarters it.
claims:
  - id: large-deflection
    statement: >-
      Under a tip force FL²/EI = 2 the chain's tip falls by the elastica's 0.4935 L, found by shooting on EI θ'' =
      F cos θ with RK4, within 2e−4 L.
    readout: tip deflection, measured (L)
    expect: { against: 'tip of the elastica by shooting, down (L)', tolerance: 0.0002 }
  - id: large-deflection-across
    statement: >-
      Its tip has come in to the elastica's 0.8394 L from the wall within 2e−5 L.
    readout: tip across, measured (L)
    expect: { against: 'tip of the elastica by shooting, across (L)', tolerance: 0.00002 }
  - id: linear-overshoots
    statement: >-
      At that load the linear beam's FL³/3EI overstates the deflection by more than a tenth of L.
    readout: tip deflection, measured (L)
    expect: { against: tip deflection of the linear beam FL³/3EI (L), below: -0.1 }
  - id: small-tip
    statement: >-
      Under FL²/EI = 0.01 the tip falls by FL³/3EI within 1e−6 L; the chain's 40 cells are short by 1/(4N²) of it.
    readout: tip deflection, measured (L)
    expect: { against: tip deflection of the linear beam FL³/3EI (L), tolerance: 0.000001 }
    setup:
      params: { force: 0.01 }
  - id: small-weight
    statement: >-
      Under its own weight qL³/EI = 0.01 the tip falls by qL⁴/8EI within 1.5e−6 L.
    readout: tip deflection, measured (L)
    expect: { against: tip deflection of the linear beam qL⁴/8EI (L), tolerance: 0.0000015 }
    setup:
      params: { load: weight, weight: 0.01 }
  - id: heavy-weight-short
    statement: >-
      Under qL³/EI = 4 the linear beam's qL⁴/8EI overstates the deflection by more than 0.05 L.
    readout: tip deflection, measured (L)
    expect: { against: tip deflection of the linear beam qL⁴/8EI (L), below: -0.05 }
    setup:
      params: { load: weight, weight: 4 }
  - id: euler-load
    statement: >-
      The chain's buckling load, where its Hessian's first pivot turns negative, is Euler's π²EI/(2L)² within
      6e−4 EI/L².
    readout: Euler’s load of the chain, by bisection on its Hessian’s pivots (EI/L²)
    expect: { against: Euler’s load π²EI/(2L)² of the column (EI/L²), tolerance: 0.0006 }
    setup:
      params: { load: column }
  - id: post-buckled-side
    statement: >-
      At 1.5 times Euler's load the tip has moved sideways by the elastica's 2k/λ, λL = K(k), within 3e−4 L.
    readout: sideways tip, measured (L)
    expect: { against: sideways tip of the post-buckled elastica 2k/λ (L), tolerance: 0.0003 }
    setup:
      params: { load: column, ratio: 1.5 }
  - id: post-buckled-height
    statement: >-
      And its height is the elastica's 2E(k)/λ − L within 4e−4 L.
    readout: height of the tip, measured (L)
    expect: { against: height of the post-buckled elastica 2E(k)/λ − L (L), tolerance: 0.0004 }
    setup:
      params: { load: column, ratio: 1.5 }
  - id: looped-side
    statement: >-
      At four times Euler's load, bent past 150°, the sideways tip still matches 2k/λ within 6e−4 L.
    readout: sideways tip, measured (L)
    expect: { against: sideways tip of the post-buckled elastica 2k/λ (L), tolerance: 0.0006 }
    setup:
      params: { load: column, ratio: 4 }
  - id: stays-straight
    statement: >-
      At 0.9 of Euler's load the column, nudged by 1e−5 of its load, moves sideways by less than 1e−3 L.
    readout: sideways tip, measured (L)
    expect: { below: 0.001 }
    setup:
      params: { load: column, ratio: 0.9 }
  - id: balanced
    statement: >-
      (numerics) Every load step ends with each |∂Π/∂θ| below 1e−10 of κ.
    readout: largest |∂Π/∂θ| over κ at the last step, numerics
    expect: { below: 0.0000000001 }
  - id: column-balanced
    statement: >-
      (numerics) So does the buckled column's, past the bifurcation.
    readout: largest |∂Π/∂θ| over κ at the last step, numerics
    expect: { below: 0.0000000001 }
    setup:
      params: { load: column, ratio: 1.5 }
---

A thin beam clamped at one end bends under a load at the other; a column pushed along its axis stays straight until the push is large enough, then bends sideways all at once. Both are the same elastic beam, and the same chain of links and springs is loaded here in both ways, as far as the load takes it.

**The chain.** The beam is cut into N cells. Each cell's bending is a rotational spring κ = EI/Δs at its middle, and the springs are joined by rigid links Δs long, with a half-link at each end: Hencky's chain. Its energy is the springs' Σ κ/2 (θ_j − θ_{j−1})² less the work of the loads. The work depends on each segment's angle only through the sum of the forces beyond it, so the energy's Hessian is tridiagonal, and a Newton step costs one pass up and down the chain. The load rises in 400 steps, each starting from the last shape; where the Hessian is not positive definite, past a buckling load, the step is shifted until it is and a line search on the energy keeps it going downhill.

**Bending.** For a small load the chain's tip falls by the midpoint sum of F(L − s)² Δs/EI, which tends to FL³/3EI as 1/N². Under its own weight it is qL⁴/8EI. A large load turns the beam towards itself: its lever arm shortens, and the tip falls less than the linear beam says. The plate holds it to the elastica, the continuous beam's own equation EI θ'' = F cos θ with θ = 0 at the clamp and no moment at the tip, solved by shooting with RK4 as the force is raised from zero. That computation never sees the chain. The dashed curve in the panel is the elastica, or the linear beam under the weight.

**Buckling.** Straight, the column's Hessian is the springs' less P times the links' lengths. Its first pivot turns negative at the chain's buckling load, found by bisection on how many pivots are negative; it approaches Euler's π²EI/(2L)² from below as the cells are halved. Above that load, a nudge at the tip picks a side and the column bends to the post-buckled elastica. With λ = √(P/EI) its tip angle α has λL = K(sin(α/2)), the complete elliptic integral of the first kind. Its tip moves sideways by 2k/λ and comes down to 2E(k)/λ − L, both computed by the arithmetic–geometric mean. This is the pendulum's equation with arc length for time, and the same K sets a bead's time to the bottom of a circle in #/p/constrained-motion.

The plate takes no reader's data: its inputs are a load and a beam's division into cells, and a reader's measured deflections call for a fit, which is least-squares's work.
