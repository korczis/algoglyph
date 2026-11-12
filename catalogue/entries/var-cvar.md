---
id: var-cvar
title: Value at risk and expected shortfall
taxonomy: inference/uncertainty
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - risk
  - tails
  - quantiles
complexity: "n log n to sort the simulated losses"
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Read value at risk as the level-quantile of the losses, expected shortfall as the mean beyond it.
  - Check the normal reference values at 95%, 1.645 and 2.063 standard deviations.
  - Explain why heavy tails and rare jumps move expected shortfall more than value at risk.
algorithm:
  paradigm: simulation
claims:
  - id: normal-var-at-95
    statement: >-
      For normal losses at 95% value at risk is 1.645 standard deviations, within three asymptotic
      standard errors of the quantile of 20,000 runs, 3 √(0.95 × 0.05 / 20000) / φ(1.645) = 0.045.
    readout: Value at risk 95.0%
    expect: { value: 1.645, tolerance: 0.045 }
    setup:
      params: { scenario: normal, level: '0.95' }
  - id: normal-es-at-95
    statement: >-
      For normal losses at 95% expected shortfall is φ(1.645) / 0.05 = 2.063 standard deviations,
      within three asymptotic standard errors of the tail mean of 20,000 runs (0.052).
    readout: Expected shortfall
    expect: { value: 2.063, tolerance: 0.052 }
    setup:
      params: { scenario: normal, level: '0.95' }
  - id: jumps-barely-move-var-at-90
    statement: >-
      Jumps in one run of fifty lie beyond the 90% quantile, so value at risk moves only from the
      normal 1.282 to 1.394, the 90% quantile of the jump mixture, within three asymptotic
      standard errors of 20,000 runs (0.043).
    readout: Value at risk 90.0%
    expect: { value: 1.394, tolerance: 0.043 }
    setup:
      params: { scenario: jumps, level: '0.9' }
  - id: jumps-move-shortfall-at-90
    statement: >-
      At the same 90% level expected shortfall sees the jumps: it rises from the normal 1.755 to
      2.679, the tail mean of the jump mixture, within three asymptotic standard errors (0.155).
    readout: Expected shortfall
    expect: { value: 2.679, tolerance: 0.155 }
    setup:
      params: { scenario: jumps, level: '0.9' }
  - id: jumps-more-than-double-var-at-99
    statement: >-
      At 99%, above one minus the jump probability, the quantile falls among the jumps and value
      at risk more than doubles, from the normal 2.326 to 5.577, the 99% quantile of the jump
      mixture, within three asymptotic standard errors of 20,000 runs (0.477).
    readout: Value at risk 99.0%
    expect: { value: 5.577, tolerance: 0.477 }
    setup:
      params: { scenario: jumps }
---

The loss exceeded with a given probability, and the average of the losses beyond it.

Value at risk at level α is the α-quantile of the loss distribution, read here as the smallest simulated loss with at least α of the runs at or below it; expected shortfall is the mean of the losses at or beyond it. Their standard errors come from ten independent batches of runs, and are withheld while a batch's tail holds too few losses to mean anything.

For normal losses at 95% the two are 1.645 and 2.063 standard deviations. The heavy-tailed portfolio, five Student-t positions with four degrees of freedom sharing one factor, pushes expected shortfall further from VaR. Rare jumps, in one run of fifty, barely move VaR at levels below 1 − 0.02 = 98%, where the jumps lie beyond the quantile and only shortfall sees them: at 90% VaR moves from 1.28 to 1.39 while shortfall rises from 1.76 to 2.68. At 99% the quantile falls among the jumps and VaR more than doubles, from 2.33 to 5.58. Few runs land in the tail, so tail estimates converge slowly.
