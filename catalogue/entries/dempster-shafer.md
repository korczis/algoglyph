---
id: dempster-shafer
title: Dempster–Shafer combination
taxonomy: inference/belief
status: live
engine: stochastic
sources:
  - id: practice-investigation
tags:
  - belief functions
  - plausibility
complexity: "quadratic in the number of focal sets per combination"
motivation: Link analysis in investigations and due diligence leans on it.
---

Belief and plausibility as an interval, and the rule that combines two sources.

A mass function spreads belief over sets of hypotheses rather than single ones; mass on the whole frame Θ is ignorance. Dempster's rule multiplies the masses of every pair of sets from the two sources and assigns the product to their intersection; products whose intersection is empty are the conflict K, discarded by renormalising with 1 − K.

Each bar runs from belief (the mass that implies the set) to plausibility (the mass that does not contradict it); the tick is the mass on the set itself. When sources disagree sharply K approaches 1 and the renormalisation magnifies whatever little they share, the behaviour Zadeh's example made famous. At K = 1 nothing is left to renormalise: the rule is undefined there, and the plate says so rather than inventing a combination.
