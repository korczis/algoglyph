---
id: double-pendulum
title: Chaos Fan
taxonomy: dynamics/chaos
status: live
engine: custom
tags:
  - chaos
  - Runge–Kutta
  - Hamiltonian
complexity: RK4, O(pendulums) per step
---

A fan of double pendulums released a millionth of a radian apart: for a few swings they move as one, then chaos tears them into a spray.

Each pendulum is two equal point masses on rigid, massless rods, integrated with the fourth-order Runge–Kutta method. They differ only in the lower arm's starting angle, spread by the chosen offset across the fan.

The motion is deterministic but sensitive to initial conditions: the gap between the outermost pendulums grows roughly exponentially until it fills the whole circle. The readout measures that spread, and the energy drift of the first pendulum shows how faithful the integrator still is (no damping is applied).

Lower the step size or raise the substeps to keep the energy drift small; raise the offset to make the fan break early.
