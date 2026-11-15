---
id: barnes-hut
title: Quadtree Cosmos
taxonomy: physics/gravitation
status: live
engine: custom
tags:
  - quadtree
  - gravity
  - approximation
complexity: O(N log N) per step, leapfrog KDK
experiments:
  - id: exact
    title: Direct summation
    params: { theta: 0, count: 600 }
    observe: Every cell is opened; the error is round-off and the interactions per body are n − 1.
  - id: coarse
    title: A wide opening angle
    params: { theta: 1.2 }
    observe: Far fewer interactions, a force error of a few percent, and the disc still holds together.
claims:
  - id: theta-zero-is-direct
    statement: >-
      At θ = 0 the tree opens every cell and its force is direct summation's, a second implementation sharing
      no code with it, to round-off: the mean relative error over every fifteenth body is below 1e−10 %.
    readout: force error at the last completed run, every 15th body
    expect: { below: 0.0000000001 }
    setup:
      params: { theta: 0, count: 600, runs: 1 }
  - id: default-error
    statement: >-
      At the default θ = 0.7 the tree's forces stay within 2 % of direct summation on average (about 0.9 %
      measured), at a small fraction of its interactions.
    readout: force error at the last completed run, every 15th body
    expect: { below: 2 }
    setup:
      params: { runs: 1 }
---

Thousands of stars under gravity, and the quadtree that makes it cheap: Barnes–Hut lumps distant stars into one mass and turns N² pairs into N log N.

Every step the plane is split into a quadtree until no leaf holds more than one body, and each cell stores its total mass and centre of mass. To find the pull on a body the tree is walked from the root: a cell of side s at distance d from its centre of mass counts as a single mass when s / d < θ and it does not contain the body; any other cell is opened. Forces are softened Newtonian gravity, integrated with kick-drift-kick leapfrog.

θ trades accuracy for work. At θ = 0 every cell is opened and the result is the direct sum over all N − 1 other bodies; at θ = 0.7 a body in these scenes needs about 70 to 100 interactions, growing only slowly with N. The readouts count them for the step just taken and measure the mean relative force error against direct summation for 16 random bodies each frame.

The lines are the tree itself, fainter the deeper the cell: dense arms and cores split into fine mesh, empty space stays coarse. Colour is the radius each star started at (with two discs, also which disc), so the winding into spiral arms stays visible.
