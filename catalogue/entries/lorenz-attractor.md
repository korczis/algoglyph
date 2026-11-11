---
id: lorenz-attractor
title: Lorenz Butterfly
taxonomy: dynamics/chaos
status: live
engine: custom
tags:
  - chaos
  - strange attractor
  - 3D
complexity: RK4, O(tracers × trail)
interaction: Drag to orbit, scroll to zoom.
---

A swarm of tracers on the Lorenz system, released a hair apart, smearing across both wings of the strange attractor. Drag to orbit, scroll to zoom.

Edward Lorenz's 1963 three-variable model of convection: dx/dt = σ(y − x), dy/dt = x(ρ − z) − y, dz/dt = xy − βz. With σ = 10, β = 8/3 and ρ = 28 the orbits never settle and never repeat, wrapping round two unstable fixed points.

All tracers start within 10⁻⁴ of each other and are integrated with RK4. The readout measures how far apart the swarm has drifted: a few orbits are enough to lose every trace of the shared start.

Lower ρ below about 24.74 and the wings become stable fixed points; the swarm spirals in and stops. Colour is speed along the trail.
