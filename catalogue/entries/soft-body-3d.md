---
id: soft-body-3d
title: Jelly Physics
taxonomy: physics/mechanics
status: live
engine: custom
sources:
  - id: matyka-pressure-soft-body
    ref: arXiv physics/0407003
tags:
  - mass-spring
  - Verlet
  - pressure
  - 3D
complexity: O(springs + faces) per step, velocity Verlet
interaction: Drag to orbit, scroll to zoom.
related:
  - verlet-cloth
---

Point masses on damped springs: drop a jelly cube or a gas-filled ball on the floor, or watch a column pinned at its base wobble. Colour is the local strain.

The cube and the column are lattices of masses joined by structural springs (axis neighbours), shear springs (face and body diagonals) and bending springs (second neighbours), which keep a solid's shape. The ball is a geodesic membrane with an ideal gas inside (the pressure model of Matyka and Ollila): a lattice ball would be a voxel staircase. The gas pushes every face outwards with p·area, p = nRT / V, which summed over the closed surface is exactly the force of the potential −nRT·ln V.

Velocity Verlet (kick-drift-kick) integrates the masses, with spring damping along each spring as a fraction of its critical damping. The ground projects masses back to y = 0, keeps a fraction of the impact speed (restitution) and removes tangential speed up to friction × the normal impulse (Coulomb). The steps per frame rise above the control when the spring network's Gershgorin frequency bound demands it; when that would exceed the frame's work budget, the plate keeps the stable step, takes fewer of them and runs in slow motion, and the readout says how slow.

Faces are coloured by the mean strain of their masses' structural springs, compressed at the low end of the palette and stretched at the high end. The energy readout and chart sum kinetic, gravitational, spring and gas energy, measured from the release and again from every change of a physical control. Ground impacts and damping change it; set damping to 0 on the column at the default stiffness, which then never touches the floor, and it holds to better than a thousandth of a per cent, as a symplectic integrator should. Drag to orbit.
