---
id: ripple-tank
title: Ripple Tank
taxonomy: physics/waves
status: live
engine: custom
tags:
  - waves
  - interference
  - finite differences
complexity: O(cells) per step, explicit FD
interaction: Click or drag to drop pebbles.
---

The wave equation on a grid: two sources, a double slit, a single slit. Switch to intensity and Young's interference fringes develop out of the noise.

The water surface is the 2D wave equation solved by explicit finite differences (leapfrog in time, five-point Laplacian in space) with a Courant number of √0.24, inside the stability limit. An absorbing sponge at the edges keeps reflections down.

Double slit: a plane wave hits a wall with two openings; each opening becomes a new source (Huygens) and the two circular waves interfere. The intensity view averages the squared height over time, so bright fringes are where crests meet crests and dark ones where crests meet troughs.

Click or drag in the tank to drop pebbles. Shorter wavelengths give more, narrower fringes.
