---
id: four-vectors
title: Fields and Four-Vectors in a Moving Frame
taxonomy: physics/relativity
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - Lorentz transformation of E and B
  - electromagnetic field tensor
  - invariant mass
  - magnetism from relativity
sources:
  - id: jackson-1999
    ref: '§11.10 (transformation of electromagnetic fields) and §11.9 (the field tensor)'
    purpose: proof
  - id: taylor-wheeler-1992
    ref: 'Chapter 7 (momenergy)'
    purpose: further-reading
tags:
  - special relativity
  - electromagnetic field
  - field tensor
  - four-momentum
  - invariant mass
complexity: O(slider positions) for the invariance readouts; 4×4 products for the tensor
interaction: The menu picks the field, the collision or the current; the slider sets the observer's velocity.
motivation: Electric and magnetic fields as one object, and the quantities every observer agrees on.
pedagogy:
  difficulty: advanced
  prerequisites:
    - minkowski-diagram
  objectives:
    - Transform E and B to a moving frame and see a pure electric field acquire a magnetic part.
    - Check that E·B and E² − B² are the same for every observer, and what that forbids.
    - Use the invariant mass of a collision to find the threshold of a reaction.
    - Read the magnetic force between a current and a moving charge as an electric force in the charge's own frame.
  misconceptions:
    - Electric and magnetic fields are not separately real; which part is which depends on the observer.
    - A current-carrying wire is neutral in the lab, but not in the frame of a charge moving along it.
  questions:
    - Can any observer see a pure magnetic field where the lab sees a pure electric one?
    - Why does a beam on a fixed target need 7 m, not 4 m, to make a proton–antiproton pair?
    - Which density does length contraction change in the charge's frame, the ions' or the electrons', and why does the wire then repel or attract?
algorithm:
  paradigm: transform
  invariants:
    - E·B and E² − B² are unchanged by every boost the slider reaches.
    - The invariant mass of a four-momentum is the same in every frame.
relations:
  - type: related_to
    target: minkowski-diagram
    reason: The same boost, applied to the field and to energy and momentum instead of to events.
experiments:
  - id: e-becomes-b
    title: A pure E field seen from a moving frame
    params: { view: fields, field: e, beta: 0.6 }
    observe: The observer sees E′ = γ E and a magnetic field B′ = −γ v × E; E² − B² is unchanged.
  - id: threshold
    title: The antiproton threshold
    params: { view: collision, energy: 7 }
    observe: At a 7 m beam on a target at rest the invariant mass reaches 4 m, enough for p p → p p p p̄.
  - id: wire
    title: Magnetism as relativity
    params: { view: wire, drift: 0.1, u: 0.5 }
    observe: The lab's magnetic force equals the electric force in the charge's frame, transformed back.
claims:
  - id: e-dot-b-is-invariant
    statement: >-
      For an oblique field, over every observer velocity the slider allows from −0.99 c to 0.99 c,
      E·B changes by less than 1e-12 of the field's scale.
    readout: largest relative change of E·B over every boost the slider allows
    expect: { below: 1.0e-12 }
    setup:
      params: { view: fields, field: oblique }
  - id: e2-minus-b2-is-invariant
    statement: >-
      Over the same velocities E² − B² changes by less than 1e-12 of the field's scale.
    readout: largest relative change of E² − B² over every boost the slider allows
    expect: { below: 1.0e-12 }
    setup:
      params: { view: fields, field: oblique }
  - id: formulas-are-the-tensor
    statement: >-
      The component formulas E′⊥ = γ (E + v × B)⊥, B′⊥ = γ (B − v × E)⊥ agree with transforming the
      field tensor, F′ = Λ F Λᵀ, to within 1e-11 at 0.9 c.
    readout: field formulas against F′ = Λ F Λᵀ
    expect: { below: 1.0e-11 }
    setup:
      params: { view: fields, field: oblique, beta: 0.9 }
  - id: antiproton-threshold
    statement: >-
      A beam of energy 7 m on a proton at rest has invariant mass √s = √(2m² + 2Em) = 4 m: exactly
      the threshold of p p → p p p p̄.
    readout: invariant mass √s in the lab, units of m
    expect: { value: 4, tolerance: 1.0e-9 }
    setup:
      params: { view: collision, energy: 7 }
  - id: invariant-mass-is-invariant
    statement: >-
      An observer at 0.9 c measures the same invariant mass as the lab, to within 1e-9.
    readout: invariant mass √s seen by the observer
    expect: { against: 'invariant mass √s in the lab, units of m', tolerance: 1.0e-9 }
    setup:
      params: { view: collision, energy: 15, beta: 0.9 }
  - id: magnetism-is-relativity
    statement: >-
      The lab's magnetic force on a charge moving at 0.5 c beside a wire whose electrons drift at
      0.1 c equals the electric force in the charge's own frame, transformed back, to a relative
      1e-12.
    readout: the two, relative difference
    expect: { below: 1.0e-12 }
    setup:
      params: { view: wire, drift: 0.1, u: 0.5 }
---

The electric and magnetic fields an observer measures depend on how the observer moves, and two combinations of them do not.

Everything is in units where c = 1. A moving observer sees E′∥ = E∥, B′∥ = B∥, E′⊥ = γ (E + v × B)⊥ and B′⊥ = γ (B − v × E)⊥. The plate computes these from the formulas and again by transforming the field tensor, F′ = Λ F Λᵀ, and shows the larger difference. The two panels draw the y and z components in the lab and for the observer, and the readouts list E·B and E² − B² in both frames. Every velocity the slider can reach is applied, and the largest change of each invariant is reported.

The collision view adds a beam of energy E to a target of mass m at rest. Its invariant mass √s is the same in the lab, for the observer and in the centre-of-momentum frame. A 7 m beam is the threshold for making a proton–antiproton pair, where √s reaches 4 m.

The wire view recomputes the classic argument that magnetism follows from relativity. In the lab the wire is neutral and a charge moving beside it feels a magnetic force q u λ w / (2π r). In the charge's own frame the ions and the electrons move at different speeds, so their densities change by different factors of γ, and the wire carries a net charge. The force there is electric, and a transverse force is γ times larger in the frame where the charge is at rest. Divided back, it is the lab's magnetic force.
