---
id: n-body
title: Galactic Waltz
taxonomy: physics/gravitation
status: live
engine: custom
tags:
  - gravity
  - symplectic
  - 3D
complexity: O(n²) per step, leapfrog KDK
interaction: Drag to orbit, scroll to zoom.
---

Newtonian gravity between every pair of bodies: a disc in orbit, two galaxies colliding, or a cold cube collapsing into a cluster. Drag to orbit.

Every body pulls on every other (direct summation, O(n²) pairs) with a small softening length so close encounters stay finite. The integrator is kick-drift-kick leapfrog: symplectic, so the total energy oscillates around its true value instead of drifting away, and momentum is conserved to rounding error.

Two galaxies: two discs with heavy cores on a grazing approach. Watch tidal tails and a bridge of stars form, the shapes Toomre & Toomre explained with this kind of experiment in 1972.

Cold collapse: a uniform cube released at rest falls in on itself, overshoots, and settles into a hot, round cluster: violent relaxation. Colour is speed.
