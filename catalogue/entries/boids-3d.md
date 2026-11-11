---
id: boids-3d
title: Murmuration
taxonomy: dynamics/collective
status: live
engine: custom
tags:
  - flocking
  - emergence
  - spatial grid
  - 3D
complexity: O(N·k) per step, uniform grid (k neighbours a bird)
interaction: Drag to orbit, scroll to zoom.
---

Reynolds boids in a box: separation, alignment and cohesion among near neighbours, found with a uniform grid, fold a random swarm into flowing flocks. Drag to orbit.

Craig Reynolds' boids (1987). Each bird sees only neighbours within the perception radius and steers by three rules: separation (away from those closer than half the radius, the nearest pushing hardest), alignment (towards their mean heading) and cohesion (towards their centre). Each rule is a steering force, the desired velocity at full speed minus the current one, capped at a maximum force; speed stays between 40 % of the maximum and the maximum, and soft walls turn birds back near the faces of the box. Nothing in the code describes a flock.

Testing every pair costs N(N−1) distance checks a step. A uniform grid with cells at least one radius wide sorts the birds by cell, and each bird tests only the 27 cells around its own, so the cost grows with N times the local density. The readout counts the checks actually made against N(N−1).

Polarisation is the length of the mean unit velocity: near 0 for the random start, 1 when all fly the same way. Set separation and cohesion to zero and alignment alone orders the swarm; raise separation and the mean nearest-neighbour distance opens. Real starlings seem to track about seven nearest neighbours whatever their distance (Ballerini et al., 2008); these boids use a fixed radius instead.
