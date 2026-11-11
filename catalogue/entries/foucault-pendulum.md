---
id: foucault-pendulum
title: Foucault's Rosette
taxonomy: physics/mechanics
status: live
engine: custom
tags:
  - Coriolis
  - rotating frame
  - 3D
complexity: RK4, constant per step
interaction: Drag to orbit, scroll to zoom.
---

A pendulum in the Panthéon, with the Earth spun up a few thousand times: its swing plane turns under it and its shadow draws a rosette on the floor. Drag to orbit.

In 1851 Léon Foucault hung a 67 m pendulum in the Panthéon in Paris and showed that its plane of swing turns slowly, clockwise, because the floor rotates with the Earth beneath it. In the Earth's frame the turning is the Coriolis force, 2Ω × v.

This is the small-angle pendulum in the rotating frame, integrated with RK4. The plane precesses at Ω·sin(latitude): a full turn takes one sidereal day at a pole, about 32 hours in Paris, and never happens on the equator. The rotation is sped up so it is visible; the readout fits the precession rate from the swing's turning points and compares it with Ω·sin(latitude).

Released from rest relative to the floor, the bob traces a rosette with sharp cusps at its turning points. Move to the southern hemisphere and it turns the other way.
