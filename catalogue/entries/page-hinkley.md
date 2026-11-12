---
id: page-hinkley
title: Page–Hinkley change detection
taxonomy: dynamics/change
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - change detection
  - cusum
complexity: "constant time and memory per sample"
related:
  - drift-divergence
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
---

A cumulative deviation that alarms when the mean of a stream has moved.

The statistic sums each sample's excess over the running mean, less a tolerance δ, and tracks how far that sum has climbed above its lowest point; while the mean holds still the sum drifts down by δ per sample, and after an upward shift it climbs. An alarm is raised the first time the climb exceeds λ.

δ trades sensitivity against false alarms: a shift smaller than δ is never noticed, and a larger δ makes long quiet stretches safer. λ sets the delay: a shift of size s above δ needs roughly λ/(s − δ) samples to alarm. Set the shift to zero to watch a stationary stream, where any alarm is false.
