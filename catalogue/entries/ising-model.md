---
id: ising-model
title: Magnet Weather
taxonomy: physics/statistical
status: live
engine: custom
tags:
  - statistical mechanics
  - phase transition
  - Monte Carlo
complexity: O(spins) per sweep, Metropolis single-spin flips
interaction: Click or drag to paint a patch of spins opposite to the one under the pointer.
schema: algoglyph.entry/v2
sources:
  - id: onsager-1944
    purpose: proof
  - id: yang-1952
    ref: 'The spontaneous magnetisation (1 − sinh⁻⁴(2/T))^(1/8) below Tc'
    purpose: proof
  - id: newman-barkema-1999
    ref: 'Chapter 3 (the Ising model and the Metropolis algorithm)'
    purpose: implementation
relations:
  - type: related_to
    target: simulated-annealing
    reason: The same Metropolis acceptance min(1, e^(−ΔE/T)), there used to search and here to sample a temperature.
pedagogy:
  difficulty: intermediate
  objectives:
    - Read the spontaneous magnetisation below Tc off a run and compare it with Yang's closed form.
    - Sweep the field below Tc and see the magnetisation lag behind it in a hysteresis loop.
    - Account for the loop's area as the heat the bath receives, from the energy's two ways of changing.
  misconceptions:
    - The loop is not a property of the magnet alone; a slower sweep gives the lattice time to follow and narrows it.
    - Above Tc the loop does not vanish at once at a finite sweep rate; it shrinks to a thin lag.
  questions:
    - Why must the work the field does over a closed cycle end up in the bath when the lattice returns to the same state?
    - Why does the magnetisation keep its sign past h = 0 on the way down below Tc, but not above it?
experiments:
  - id: hysteresis-below-tc
    title: A hysteresis loop below Tc
    params: { drive: sweep, temperature: 1.5, start: ordered }
    observe: The magnetisation stays up well past h = 0 and flips near the coercive field; the loop's area matches the heat to the bath.
  - id: slower-sweep
    title: A slower sweep narrows the loop
    params: { drive: sweep, temperature: 1.5, rate: 10, start: ordered }
    observe: With five times the sweeps per field step the lattice follows the field more closely and the loop area falls.
  - id: above-tc
    title: Above Tc the loop nearly closes
    params: { drive: sweep, temperature: 4, start: ordered }
    observe: The magnetisation follows the field almost reversibly; the area and the heat are a small fraction of their values below Tc.
  - id: spontaneous-magnetisation
    title: Spontaneous magnetisation at h = 0
    params: { drive: fixed, field: 0, temperature: 1.8, start: ordered }
    observe: The mean |m| over each window settles on Yang's m₀(T).
claims:
  - id: the-books-balance
    statement: >-
      Over a cycle of the swept field, the work the field does (the loop area) plus the heat taken
      from the bath equals the change of energy exactly: kept in whole hundredths of J, the books
      leave no residual at all.
    readout: energy books residual (last cycle)
    expect: { value: 0 }
    setup:
      params: { drive: sweep, temperature: 1.5, start: ordered, runs: 2 }
  - id: loop-area-is-the-heat
    statement: >-
      Below Tc the loop area −∮ m dh per spin equals the heat the bath receives over the cycle to
      within 0.01: the cycle starts and ends in the same saturated state, so its change of energy is
      that small.
    readout: loop area −∮ m dh (last cycle)
    expect: { against: heat to the bath (last cycle), tolerance: 0.01 }
    setup:
      params: { drive: sweep, temperature: 1.5, start: ordered, runs: 2 }
  - id: hysteresis-dissipates
    statement: >-
      At T = 1.5, two sweeps per field step of 0.01 and h₀ = 1, the loop is wide: it dissipates
      more than 1 per spin per cycle.
    readout: heat to the bath (last cycle)
    expect: { above: 1 }
    setup:
      params: { drive: sweep, temperature: 1.5, start: ordered, runs: 2 }
  - id: above-tc-the-loop-nearly-closes
    statement: >-
      At T = 4, above Tc, the same sweep leaves a loop of area under 0.05 per spin: the paramagnet
      follows the field almost reversibly.
    readout: loop area −∮ m dh (last cycle)
    expect: { below: 0.05 }
    setup:
      params: { drive: sweep, temperature: 4, start: ordered, runs: 2 }
  - id: yang-at-1-8
    statement: >-
      At T = 1.8 and h = 0, started ordered, the mean |m| over 200 sweeps is within 0.005 of Yang's
      spontaneous magnetisation (1 − sinh⁻⁴(2/T))^(1/8) ≈ 0.958.
    readout: mean |m| over the last 200 sweeps
    expect: { against: 'Yang m₀(T), h = 0', tolerance: 0.005 }
    setup:
      params: { drive: fixed, field: 0, temperature: 1.8, start: ordered, runs: 3 }
    source: yang-1952
  - id: yang-at-2
    statement: >-
      At T = 2.0, nearer Tc, the mean |m| over 200 sweeps is within 0.01 of Yang's value ≈ 0.911.
    readout: mean |m| over the last 200 sweeps
    expect: { against: 'Yang m₀(T), h = 0', tolerance: 0.01 }
    setup:
      params: { drive: fixed, field: 0, temperature: 2, start: ordered, runs: 3 }
    source: yang-1952
  - id: disordered-above-tc
    statement: >-
      At T = 3.5, above Tc, an ordered start melts: the mean |m| over 200 sweeps falls below 0.05,
      where Yang's formula gives 0.
    readout: mean |m| over the last 200 sweeps
    expect: { below: 0.05 }
    setup:
      params: { drive: fixed, field: 0, temperature: 3.5, start: ordered, runs: 3 }
---

A sheet of tiny magnets, each nudged by its four neighbours and shaken by heat: the 2D Ising model freezes into one colour, boils into noise, and at the critical temperature becomes clouds of every size.

Every cell is a spin, up or down, on a square lattice that wraps around at the edges. Neighbouring spins that agree lower the energy by one unit and a field h favours one sign. Each sweep proposes flipping every spin once, in checkerboard order, and keeps the flip with the Metropolis probability min(1, e^(−ΔE/T)), where ΔE = 2s(Σ neighbours + h). Bright cells are spins that flipped in the last frames; colours follow a short time-average of each spin.

Onsager solved this model exactly in 1944: with h = 0 it orders below the critical temperature Tc = 2/ln(1 + √2) ≈ 2.269. Well below it one colour takes over and |m| approaches Yang's spontaneous magnetisation (1 − sinh⁻⁴(2/T))^(1/8); well above it the sheet is salt and pepper with m near 0. Near Tc domains of every size drift and merge. A perfectly aligned sheet has energy −2 per spin.

Start ordered and raise T past Tc to watch the magnet melt; start random below Tc and domains coarsen slowly, sometimes lingering as stripes around the torus. A small h ends the stand-off in favour of one sign.

Set the field to sweep and it runs from +h₀ down to −h₀ and back in steps of 0.01. Below Tc the magnetisation keeps its sign well past h = 0 and flips only near the coercive field, tracing a hysteresis loop. The energy changes in exactly two ways: a field step at fixed spins does work −M Δh, and an accepted flip takes its ΔE from the bath as heat. Both are kept in whole hundredths of J, so over each cycle the loop area −∮ m dh, the heat the bath receives and the cycle's change of energy balance exactly, and the residual readout shows it. A cycle that starts and ends saturated changes the energy very little, so the loop area is the heat dissipated.

With the field held, each window of 200 sweeps reports its mean |m|, beside Yang's closed form for the spontaneous magnetisation. The stop-after-runs control holds the plate on a completed cycle or window, so its readouts stay still.
