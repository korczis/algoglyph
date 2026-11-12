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
---

Perturb the evidence many times and count how often the verdict survives.

The verdict adds the prior log-odds and every item's log-likelihood ratio and compares the total with zero. A run perturbs the evidence: each item holds up with its reliability and otherwise drops out, and the strength of those that hold wobbles by a normal error scaled by the noise control. Stability is the share of runs that reach the same verdict, a binomial proportion with its standard error.

An item's influence is measured from the runs themselves: how much more often the verdict flips when that item fails than when it holds. A verdict that rests on one strong but unreliable item is fragile even when the total looks decisive.
