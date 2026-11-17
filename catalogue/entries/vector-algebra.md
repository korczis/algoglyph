---
id: vector-algebra
title: Vectors on Turned and Mirrored Axes
taxonomy: physics/mechanics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - dot product
  - cross product
  - axial vector
  - pseudovector
  - change of axes
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 11 (vectors: what stays the same when the axes are turned, the dot product) and ch. 20 (rotation in space: the cross product, and why torque is an axial vector)'
    purpose: further-reading
tags:
  - vectors
  - dot product
  - cross product
  - rotation
  - reflection
  - invariance
complexity: O(1) per change
interaction: The sliders set the components of a and b and the three angles of the new axes; the toggle mirrors the new x axis.
motivation: The laws of physics are written in vectors because the dot product does not care which way the axes point, and the cross product cares only whether they are right- or left-handed.
relations:
  - type: related_to
    target: four-vectors
    reason: The same question one dimension up; there a boost changes the components of a four-vector and keeps its square, here a rotation changes a vector's components and keeps its dot products.
  - type: related_to
    target: ccw-intersection
    reason: The orientation test there is the z component of a cross product in the plane; its sign is the handedness that a mirror here reverses.
pedagogy:
  difficulty: introductory
  objectives:
  - Turn the axes and see a vector's components change while its length and its dot product with another stay the same.
  - Read the cross product's length as |a||b| sin θ and its direction by the right-hand rule.
  - See a mirrored frame reverse the cross product computed in it, the mark of an axial vector.
  misconceptions:
  - The cross product is not an ordinary vector; in a mirror its components turn the other way from those of a and b.
  - A vector's components are not the vector; they belong to the axes chosen.
  questions:
  - Which of torque, angular momentum, velocity and magnetic field change sign in a mirror, and which keep it?
  - Why is a · (b × c) unchanged by a rotation but reversed by a mirror?
algorithm:
  paradigm: transform
bounds:
  model: a dozen products per change
  worst: 'O(1): one 3 × 3 matrix of turned axes, two vectors through it'
experiments:
  - id: right-hand
    title: x × y = z
    params: { ax: 1, ay: 0, az: 0, bx: 0, by: 1, bz: 0 }
    observe: The cross product of the x and the y axes' unit vectors is the z axis', by the right-hand rule.
  - id: mirror
    title: In a mirror
    params: { mirror: true }
    observe: In a left-handed frame the cross product computed there points opposite to the true one turned onto the axes; the gap is twice its length.
  - id: parallel
    title: Parallel vectors
    params: { ax: 1, ay: 2, az: -1.5, bx: 2, by: 4, bz: -3 }
    observe: The cross product of parallel vectors is zero, and their angle is 0°.
  - id: perpendicular
    title: Perpendicular vectors
    params: { ax: 3, ay: 0, az: 0, bx: 0, by: 0, bz: 2 }
    observe: The dot product is 0 and |a × b| is |a||b| = 6, pointing along −y.
  - id: tumbled
    title: Tumbled axes
    params: { yaw: 135, pitch: -60, roll: 170 }
    observe: Every component of a and b on the new axes changes, and a · b and a × b turned with them do not.
claims:
  - id: cross-length-lagrange
    statement: >-
      Lagrange's identity: |a × b|² = |a|²|b|² − (a · b)², the right side computed from the controls
      alone; at the default vectors, a few roundings of numbers near 30, within 1e−13.
    readout: '|a × b|² against |a|²|b|² − (a·b)²'
    expect: { below: 1.0e-13 }
  - id: cross-is-perpendicular
    statement: >-
      a × b is perpendicular to both: |(a × b) · a| + |(a × b) · b| vanishes within 1e−13.
    readout: a × b against a and b, |(a×b)·a| + |(a×b)·b|
    expect: { below: 1.0e-13 }
  - id: dot-is-invariant
    statement: >-
      On axes turned by yaw 30°, pitch 20° and roll 10° every component of a and b changes, and
      a′ · b′ is a · b = 1.84 within 1e−13.
    readout: a′ · b′ − a · b
    expect: { below: 1.0e-13 }
  - id: cross-turns-with-the-axes
    statement: >-
      On turned axes the cross product taken from the new components is the old cross product's
      components on the new axes: they agree to the readout's six decimals.
    readout: a′ × b′ against (a × b) on the new axes
    expect: { value: 0, tolerance: 0.000001 }
  - id: mirror-reverses-the-cross
    statement: >-
      With the new x axis mirrored the frame is left-handed; the cross product taken there points
      opposite to the old one on the new axes, and the gap between them is 2|a × b| = 2√(1.88² +
      3.88² + 4.02²) = 11.789690.
    readout: a′ × b′ against (a × b) on the new axes
    expect: { value: 11.78969, tolerance: 0.000001 }
    setup:
      params: { mirror: true }
  - id: mirror-is-the-determinant
    statement: >-
      What the mirror does is the axes' determinant, −1: a′ × b′ = det · (a × b) on the new axes,
      within 1e−13.
    readout: a′ × b′ against det · (a × b) on the new axes
    expect: { below: 1.0e-13 }
    setup:
      params: { mirror: true }
  - id: right-hand-rule
    statement: >-
      The unit vectors of y and x, in that order, have the cross product (0, 0, −1): its z component
      is −1, the right-hand rule reversed with the order, since b × a = −(a × b).
    readout: z component of a × b
    expect: { value: -1, tolerance: 0 }
    setup:
      params: { ax: 0, ay: 1, az: 0, bx: 1, by: 0, bz: 0 }
---

Two vectors, their dot and cross products, and the same products taken again on axes that have been turned, or turned and mirrored.

A vector is an arrow; its three components are its shadows on three axes someone chose. Turn the axes and every component changes, but some things do not: the arrow's length, and the dot product a · b = |a||b| cos θ, which knows only the arrows and the angle between them. That is why a law written with dot products holds on any axes. The cross product a × b is the arrow perpendicular to both, |a||b| sin θ long, pointing the way the right-hand rule says. On turned axes it turns with them: the cross product of the new components is the old cross product's new components.

A mirror is different. Reverse one axis and the frame is left-handed; the components of a and b are still their shadows, but the cross product computed from them now points the other way from the true one. Torque, angular momentum and the magnetic field are such axial vectors. The readouts measure each statement as a gap that is zero, or, in the mirror, twice the cross product's length.

**A still.** Nothing in the picture moves: vectors and axes are compared, not followed in time, so the diagram is redrawn when a control changes and every readout is computed from the controls alone. The state travels in the URL.

**Data.** The plate takes no data of a reader's: its inputs are nine sliders and a toggle, and a list of vectors is not among the kinds ADR 0010 can read.
