---
id: drift-divergence
title: "Distribution drift: PSI, KL and Jensen–Shannon"
taxonomy: dynamics/change
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - drift
  - divergence
  - psi
complexity: "linear in the samples per window, then linear in the bins"
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Bin two windows on the same edges, with half a count added to every bin so that every logarithm is defined.
    - Check that the population stability index Σ(q − p) ln(q/p) is exactly KL(q‖p) + KL(p‖q), and that the Jensen–Shannon divergence in bits lies between 0 and 1.
    - See the divergences stay near zero but not at it with no drift, a floor of sampling noise that more samples per window lower.
  misconceptions:
    - The PSI rules of thumb, 0.1 to watch and 0.25 to act, are statistical tests; they are conventions of practice.
bounds:
  model: samples drawn and binned (a reference window, then one window per step)
  best: 82n for windows of n samples
  worst: 82n for windows of n samples
claims:
  - id: psi-is-kl-both-ways
    statement: >-
      Σ(q − p) ln(q/p) = Σ q ln(q/p) + Σ p ln(p/q), term by term, so PSI equals KL(q‖p) + KL(p‖q):
      the PSI readout and the sum in the KL readout agree within 0.0001, the two readouts' rounding
      to four decimals.
    readout: PSI
    expect: { against: KL both ways, against_number: 3, tolerance: 0.0001 }
  - id: no-drift-psi-is-small
    statement: >-
      With no drift both windows of n = 2,000 come from N(0, 1), and PSI ≈ Σ (q − p)²/p ≈ 2χ²/n with
      at most k − 1 = 21 degrees of freedom: mean at most 0.021, and PSI ≥ 0.05 needs χ² ≥ 50,
      which a χ² with 21 degrees of freedom exceeds with probability 0.00036.
    readout: PSI
    expect: { below: 0.05 }
    setup:
      params: { drift: 0, widen: 0 }
  - id: no-drift-kl-is-small
    statement: >-
      One direction is half the symmetric sum to second order: KL ≈ χ²/n, mean at most 21/2,000 =
      0.0105, and KL ≥ 0.025 needs the same χ² ≥ 50 (probability 0.00036).
    readout: KL(current ‖ reference)
    expect: { below: 0.025 }
    setup:
      params: { drift: 0, widen: 0 }
  - id: js-at-full-drift
    statement: >-
      The last window is drawn from N(1.5, 1.4²); binned on the plate's default 22 bins, its exact
      Jensen–Shannon divergence from N(0, 1) is 0.2484 bits (normal distribution functions by
      quadrature). With n = 20,000 the reading is within 0.014 of 0.248: four standard deviations
      (0.0034) over 400 other seeds (1 to 400), whose mean is within one of the exact value.
    readout: Jensen–Shannon
    expect: { value: 0.248, tolerance: 0.014 }
    setup:
      params: { n: 20000 }
  - id: psi-is-kl-both-ways-at-two-bins
    statement: >-
      The identity holds term by term at any bin count: with 2 bins PSI and the sum of the two KL
      directions agree within 0.0001, the readouts' rounding.
    readout: PSI
    expect: { against: KL both ways, against_number: 3, tolerance: 0.0001 }
    setup:
      params: { bins: 2 }
  - id: psi-is-kl-both-ways-at-200-bins
    statement: >-
      With 200 bins, most of them nearly empty and held up by the half count, PSI and KL both ways
      still agree within 0.0001.
    readout: PSI
    expect: { against: KL both ways, against_number: 3, tolerance: 0.0001 }
    setup:
      params: { bins: 200 }
  - id: no-drift-psi-at-60-bins
    statement: >-
      With 60 bins and no drift PSI ≈ 2χ²/n with at most 59 degrees of freedom: mean at most 2 ·
      59 / 2,000 = 0.059, and PSI ≥ 0.12 needs χ² ≥ 120, which a χ² with 59 degrees of freedom
      exceeds with probability 4.7e-6.
    readout: PSI
    expect: { below: 0.12 }
    setup:
      params: { drift: 0, widen: 0, bins: 60 }
---

Two histograms pulling apart, measured three ways.

Both windows are binned on the same edges (the bin count is a control), and half a count is added to every bin so that no proportion is zero and every logarithm is defined. The population stability index Σ(q − p) ln(q/p) is exactly the sum of the two Kullback–Leibler divergences, KL(q‖p) + KL(p‖q); the Jensen–Shannon divergence compares both with their average and, in bits, lies between 0 and 1.

With no drift the divergences stay near zero but not at it: two samples of one distribution differ by sampling noise, and more samples per window lower that floor. The customary PSI rules of thumb, 0.1 to watch and 0.25 to act, are conventions of practice, not statistical tests.
