---
id: human-pointing
title: A hand on the mouse
taxonomy: signals/synthesis
status: live
engine: custom
sources:
  - id: fitts-1954
    purpose: algorithm-reference
  - id: flash-hogan-1985
    purpose: algorithm-reference
tags:
  - human motion
  - Fitts' law
  - minimum jerk
  - seeded
complexity: O(samples) a move, samples = time × update rate
related:
  - pathfinding-terrain
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: []
  objectives:
    - Predict a move's time from its distance and target width with Fitts' law, and read the law's slope back from the moves drawn.
    - Explain why a minimum-jerk profile starts and ends slowly, and see it in the spacing of the samples.
    - Tell a long move's overshoot and correction from a short move's single stroke.
  misconceptions:
    - A straight line at constant speed is not how a hand moves; it is how a script does.
claims:
  - id: every-move-ends-on-its-target
    statement: >-
      Tremor rides along every move but never on its last sample, which is the target exactly: the
      largest distance from a move's end to its target is 0.0 px, within 0.05.
    readout: end error
    expect: { value: 0, tolerance: 0.05 }
  - id: fitts-slope-read-back
    statement: >-
      With no move long enough to overshoot (beyond 2000 px, more than the canvas holds), each move
      takes Fitts' MT times a noise of 8 %, so the least-squares slope of time against difficulty
      over the run's 40 moves is the model's b = 140 ms per bit within that noise: 137.5, in [126, 154].
    readout: Fitts' slope
    expect: { range: [126, 154] }
    setup:
      params: { overshoot_from: 2000 }
    source: fitts-1954
  - id: fitts-slope-follows-b
    statement: >-
      At b = 0.3 s per bit the slope read back follows it: 308.3 ms per bit, in [270, 330].
    readout: Fitts' slope
    expect: { range: [270, 330] }
    setup:
      params: { fitts_b: 0.3, overshoot_from: 2000 }
    source: fitts-1954
  - id: long-moves-overshoot
    statement: >-
      Moves longer than 280 px pass their target before coming back: on the default run all 16 of
      its 40 moves that long do, and one shorter move passes its target by its bow and tremor alone,
      17 in all, counted in the test.
    readout: overshoots
    expect: { range: [17, 17] }
bounds:
  model: samples
  worst: 'time × update rate a move: ceil(MT × rate_hz), at least 2, and for a long move both sub-movements'
---

A pointer moved the way a hand moves it: farther and smaller targets take longer, each move speeds up and slows down along a gentle bow, long moves overshoot and correct, and every one ends on its target.

Fitts' law gives a move's time: MT = a + b log2(D / W + 1) for a distance D to a target W wide, the logarithm counting the bits of difficulty. The profile is minimum jerk, 10t³ − 15t⁴ + 6t⁵ of the way at time t, the smoothest path a hand can take between two points at rest; the path is a quadratic Bézier whose control point sits off the straight line by a random fraction of the distance, because hands turn about the wrist and elbow.

Moves longer than the overshoot distance pass the target by 3 to 7 % and come back in a short second sub-movement; a pixel of tremor rides along the way, never on the last sample. The dots are the samples a sixtieth of a second apart, so their spacing is the speed.

The readouts fit Fitts' law back from the moves drawn: the slope comes out near the model's b, the intercept above its a by the correction a long move adds. The model is the OpenTTD fork's motion.rs, ported operation for operation and seeded the same way, so its player and this plate move alike; the flow's command line serves it (`npm run flow -- kernel human-pointing -`).
