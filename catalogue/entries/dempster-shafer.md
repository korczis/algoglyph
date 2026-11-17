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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Represent ignorance as mass on the whole frame Θ rather than spread over single hypotheses.
    - Read belief and plausibility as an interval, from the mass that implies a set to the mass that does not contradict it.
    - Combine two sources by Dempster's rule, and explain how the conflict K is discarded by renormalising with 1 − K and why that magnifies what sharply disagreeing sources share.
data:
  - id: sources
    title: Your sources
    kind: table
    accepts: [csv, json]
    columns:
      - { key: h1, unit: 'mass on {H1}', min: 0, max: 1.0e6 }
      - { key: h2, unit: 'mass on {H2}', min: 0, max: 1.0e6 }
      - { key: h3, unit: 'mass on {H3}', min: 0, max: 1.0e6 }
      - { key: h12, unit: 'mass on {H1,H2}', min: 0, max: 1.0e6 }
      - { key: h13, unit: 'mass on {H1,H3}', min: 0, max: 1.0e6 }
      - { key: h23, unit: 'mass on {H2,H3}', min: 0, max: 1.0e6 }
      - { key: theta, unit: 'mass on Θ', min: 0, max: 1.0e6 }
    rows: { min: 2, max: 20 }
    bytes: 65536
    replaces: evidence
    ignores: [sources, ignorance]
    url_bytes: 1800
    note: Each row is a source of evidence on three hypotheses, its masses on the seven sets that are not empty; a row is scaled to sum to 1, so its weights may be in any unit, and a row of zeros says nothing and goes wholly on Θ. Your sources are combined by Dempster's rule in their order, and a step in total conflict stops the combination, as with the plate's own.
---

Belief and plausibility as an interval, and the rule that combines two sources.

A mass function spreads belief over sets of hypotheses rather than single ones; mass on the whole frame Θ is ignorance. Dempster's rule multiplies the masses of every pair of sets from the two sources and assigns the product to their intersection; products whose intersection is empty are the conflict K, discarded by renormalising with 1 − K.

Each bar runs from belief (the mass that implies the set) to plausibility (the mass that does not contradict it); the tick is the mass on the set itself. When sources disagree sharply K approaches 1 and the renormalisation magnifies whatever little they share, the behaviour Zadeh's example made famous. At K = 1 nothing is left to renormalise: the rule is undefined there, and the plate says so rather than inventing a combination. Mass on Θ always meets mass on Θ, so total conflict needs sources that keep none there: set the least mass on Θ to 0.
