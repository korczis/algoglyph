---
id: two-slit-classical
title: Bullets Through Two Holes
taxonomy: physics/quantum
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. III, ch. 1, §1-2 (an experiment with bullets); the same chapter as Vol. I, ch. 37'
    purpose: further-reading
  - id: wilson-hilferty
    purpose: implementation
tags:
  - two-slit experiment
  - Monte Carlo
  - chi-square test
  - classical particles
complexity: O(1) per bullet; O(bins) for the comparison at the end
interaction: The knobs change the apparatus; each change fires three fresh runs.
motivation: The classical baseline every interference experiment is measured against.
pedagogy:
  difficulty: introductory
  objectives:
    - Predict the backstop curve with both holes open from the two curves with one hole shut each.
    - Read a χ² statistic against the band a correct model falls in, and see why a test needs power.
    - Keep the bookkeeping of a counting experiment, every bullet fired accounted for exactly once.
  misconceptions:
    - Adding the two one-hole curves is not a fit; it is a prediction that the both-holes run can fail.
    - A χ² inside its band does not prove the additive model; it fails to reject it, and the power check is what says the test could have.
  questions:
    - Why must the gun fire the same number of bullets in each of the three runs for N₁ + N₂ to predict N₁₂?
    - What would have to happen at the holes for N₁₂ to differ from N₁ + N₂?
    - Why does the interference hypothesis become hard to reject when the two one-hole curves barely overlap?
algorithm:
  paradigm: randomized
  properties:
    deterministic: true
  preconditions:
    - The holes do not overlap (d > a).
  invariants:
    - Fired equals blocked plus detected plus missed, in every run.
  limitations:
    - The ricochet is a chosen model, normal with standard deviation σ, applied to every bullet that passes a hole; real bullets glance off edges in ways this does not try to reproduce.
    - No bullet passes one hole and then the other, and nothing at one hole depends on whether the other is open; that independence is the model's assumption, not a result.
    - The χ² band comes from the Wilson–Hilferty approximation of the χ²ₖ quantiles, within about 1 % of the exact points for the bin counts used.
experiments:
  - id: narrow-ricochet
    title: Two separate humps
    params: { ricochet: 2 }
    observe: The one-hole curves barely overlap; the interference hypothesis has little to work with, and its χ² falls towards the band.
  - id: wide-gun
    title: A wide gun
    params: { spread: 10 }
    observe: Most bullets now hit the wall; the counts that land drop, and the χ² band widens as fewer bins pass the five-count floor.
claims:
  - id: every-bullet-counted-once
    statement: >-
      A numerics check: with both holes open, every bullet fired is counted exactly once, as stopped
      by the wall, landing on the backstop, or passing a hole and missing the backstop.
    readout: count balance, fired − blocked − detected − missed
    expect: { value: 0 }
    setup:
      params: { n: 40000 }
  - id: both-holes-above-the-band-floor
    statement: >-
      The χ²/k of the both-holes histogram against the sum of the one-hole histograms lies above the
      0.1 % point of χ²ₖ/k for the bins judged, so the two agree no better than chance allows.
    readout: χ²/k of N₁₂ against N₁ + N₂
    expect: { against: 'χ²ₖ/k band, 0.1 % to 99.9 %', against_number: 1, above: 0 }
    setup:
      params: { n: 40000 }
  - id: both-holes-below-the-band-ceiling
    statement: >-
      The same χ²/k lies below the 99.9 % point of χ²ₖ/k: bullets through two holes add up, with no
      interference term, to within the run's counting noise.
    readout: χ²/k of N₁₂ against N₁ + N₂
    expect: { against: 'χ²ₖ/k band, 0.1 % to 99.9 %', against_number: 2, below: 0 }
    setup:
      params: { n: 40000 }
  - id: enough-bins-for-the-band
    statement: >-
      The band is only used where its approximation holds: with 40,000 bullets per run at least ten
      bins pass the five-count floor, and Wilson–Hilferty is within about 1 % of the exact χ²ₖ points
      from ten bins on.
    readout: bins judged (tails merged to ≥ 5 expected)
    expect: { above: 9 }
    setup:
      params: { n: 40000 }
  - id: the-test-would-see-interference
    statement: >-
      A power check: the same both-holes histogram tested against full-contrast fringes built from
      the same one-hole counts, N₁ + N₂ + 2√(N₁N₂)·cos(2πy/Λ) with Λ four bins, gives a χ²/k more
      than 5 above the band's ceiling, so the test could have rejected additivity had the bullets
      interfered.
    readout: χ²/k against full-contrast fringes, 4-bin period
    expect: { against: 'χ²ₖ/k band, 0.1 % to 99.9 %', against_number: 2, above: 5 }
    setup:
      params: { n: 40000 }
  - id: the-test-states-its-sensitivity
    statement: >-
      The same counts would reject fringes of that period down to a visibility of 0.2: the smallest
      V for which N₁ + N₂ + 2V√(N₁N₂)·cos(2πy/Λ) lies above the band's ceiling is below 0.2, so
      agreement with the sum excludes interference at least that strong.
    readout: smallest fringe visibility this run rejects, 4-bin period
    expect: { below: 0.2 }
    setup:
      params: { n: 40000 }
---

A gun sprays bullets at a wall with two holes; behind it a backstop counts where they land. Three runs fire the same number of bullets: hole 2 shut, hole 1 shut, both open. The curve with both holes open is the sum of the other two.

The gun fires in a direction uniform within its spread. A bullet that reaches an open hole passes it and is turned by a ricochet angle drawn from a normal distribution; one that meets the wall, or a shut hole, stops there. The backstop's bins count the rest, and what lands beyond its edge is counted as missed, so every run's bookkeeping closes exactly.

Nothing a bullet does at one hole depends on the other, so the both-holes counts N₁₂ and the sum N₁ + N₂ estimate one curve. The comparison is a χ² over the bins, each squared difference divided by N₁₂ + N₁ + N₂, the variance of a difference of independent counts; bins in the tails are merged until each expects at least five bullets. A correct model's χ²/k falls between the 0.1 % and 99.9 % points of χ²ₖ/k 998 times in 1000; the readout shows both.

A test that passes is only worth something if it could fail. Two readouts say how much this one could: the χ²/k of the same histogram against full-contrast fringes four bins apart, the one-hole counts combined as waves would be, and the smallest fringe visibility the run would still reject at that period, its stated sensitivity. Where the two one-hole curves barely overlap there is little for fringes to modulate, and the sensitivity rises towards 1. The band itself is used only from ten bins on, where the Wilson–Hilferty points are within about 1 % of the exact ones. Bullets are lumps: they arrive one at a time, whole, and through one hole or the other. Compare #/p/two-slit-amplitudes, where the arrivals are just as lumpy and the curves do not add.

The default run is a demonstration: 350 bullets per run, landing about two dozen a second, so the three curves grow in under a minute and the sum can be watched taking shape from a few hundred lumps. The claims below are not computed from it; each is run at its own size, 40,000 bullets per run, named on its Run line, so its margin is the one its statistics need.
