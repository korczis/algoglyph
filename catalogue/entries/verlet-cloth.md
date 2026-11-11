---
id: verlet-cloth
title: Verlet Cloth
taxonomy: physics/mechanics
status: live
engine: custom
tags:
  - Verlet
  - constraints
  - 3D
complexity: O(links × iterations) per step
interaction: Drag to orbit, scroll to zoom.
---

A sheet of particles held together by distance constraints: hang it as a curtain, pin it by two corners, or drop it over a sphere, then blow wind through it.

Each particle moves by position Verlet integration: the velocity is implicit in the difference between its current and previous position. Structural and shear links are then relaxed by projecting each pair back to its rest length, a few iterations per step (Jakobsen's method from Hitman, 2001).

More iterations make the fabric stiffer; fewer make it stretch like jersey. The readout reports the mean strain of the links in the last relaxation pass: that stiffness, measured.

Wind is a travelling sine field pushing along the depth axis. Drag to orbit the camera.
