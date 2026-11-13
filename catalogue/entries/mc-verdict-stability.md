---
id: mc-verdict-stability
title: Monte Carlo verdict stability
taxonomy: inference/uncertainty
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - monte carlo
  - robustness
  - decisions
complexity: "one pass over the evidence per run"
related:
  - bayes-update
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Form a verdict by adding the prior log-odds and every item's log-likelihood ratio and comparing the total with zero.
    - Measure stability as the share of perturbed runs that reach the same verdict, a binomial proportion with its standard error.
    - Find the items a verdict rests on from how much more often it flips when they fail, and see why one strong but unreliable item makes it fragile.
algorithm:
  paradigm: simulation
claims:
  - id: fully-reliable-noiseless-evidence-never-flips
    statement: >-
      When the least item reliability is 1 every item's reliability is min(1, 1 + 0.4u) = 1, so
      every item holds up in every run, and with no strength noise every run adds up to the verdict
      as given: stability is exactly 100%.
    readout: Stability
    expect: { value: 100, tolerance: 0 }
    setup:
      params: { minRel: 1, noise: 0 }
  - id: sampled-stability-matches-enumeration-unreliable
    statement: >-
      With no strength noise the plate also enumerates every subset of the items that hold up and
      sums its chance, the exact stability; with reliabilities from 0.05 the 5,000 sampled runs
      stay within 3 percentage points of it, four binomial standard errors at the widest,
      4 × √(0.25 / 5000) = 2.83, plus the 0.05 rounding of each displayed percentage.
    readout: Stability
    expect: { against: Exact stability (no strength noise), tolerance: 3 }
    setup:
      params: { minRel: 0.05, noise: 0 }
  - id: sampled-stability-matches-enumeration-moderate
    statement: >-
      The same comparison with reliabilities from 0.3: the 5,000 sampled runs stay within
      3 percentage points of the enumerated stability, 4 × √(0.25 / 5000) = 2.83 plus the 0.05
      rounding of each displayed percentage.
    readout: Stability
    expect: { against: Exact stability (no strength noise), tolerance: 3 }
    setup:
      params: { minRel: 0.3, noise: 0 }
---

Perturb the evidence many times and count how often the verdict survives.

The verdict adds the prior log-odds and every item's log-likelihood ratio and compares the total with zero. A run perturbs the evidence: each item holds up with its reliability and otherwise drops out, and the strength of those that hold wobbles by a normal error scaled by the noise control. Stability is the share of runs that reach the same verdict, a binomial proportion with its standard error.

An item's influence is measured from the runs themselves: how much more often the verdict flips when that item fails than when it holds. A verdict that rests on one strong but unreliable item is fragile even when the total looks decisive.
