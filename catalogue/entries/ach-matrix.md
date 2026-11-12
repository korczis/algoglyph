---
id: ach-matrix
title: Analysis of competing hypotheses
taxonomy: inference/belief
status: live
engine: custom
sources:
  - id: heuer-psychology
tags:
  - hypotheses
  - evidence
  - intelligence analysis
motivation: Investigations and due diligence often have to weigh rival explanations of the same evidence.
complexity: 'O(evidence × hypotheses) to score and rank'
interaction: 'Click a cell to cycle its rating through II, I, N, C and CC; the scores and the ranking follow.'
related:
  - bayes-update
  - dempster-shafer
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Rank rival hypotheses by the weighted evidence that contradicts each, not by the evidence that fits it.
    - Recognise an item rated alike for every hypothesis as evidence with no diagnostic value.
    - Read the least contradicted hypothesis as a candidate to test further, and report equal scores as a tie.
claims:
  - id: true-hypothesis-ranks-first-without-misleading-evidence
    statement: >-
      With no misleading evidence (noise 0) no item contradicts the hypothesis the case was built
      on, so its weighted inconsistency is 0, the least any hypothesis can score, and it ranks
      first, alone or tied; the expectation is exact.
    readout: Rank of the hypothesis the case was built on
    expect: { value: 1, tolerance: 0 }
    setup:
      params: { noise: 0 }
  - id: true-hypothesis-ranks-first-without-diagnostic-evidence
    statement: >-
      With no misleading evidence, every item that fits all hypotheses alike rates each of them N
      or C, which adds nothing to any score, and every other item rates the true hypothesis N, C or
      CC, so the true hypothesis still scores 0 and ranks first when 80% of the items are bland as
      when none is; the expectation is exact.
    readout: Rank of the hypothesis the case was built on
    expect: { value: 1, tolerance: 0 }
    setup:
      params: { noise: 0, bland: 0.8 }
  - id: every-item-bland-every-hypothesis-ties
    statement: >-
      When every item fits every hypothesis alike (bland 1) all 12 items are counted as fitting
      every hypothesis alike; the expectation is exact, a count of the plate's 12 items.
    readout: Items that fit every hypothesis alike
    expect: { value: 12, tolerance: 0 }
    setup:
      params: { bland: 1 }
  - id: every-item-bland-no-lead
    statement: >-
      When every item fits every hypothesis alike no cell is rated I or II, so every score is 0 and
      the least contradicted hypothesis leads the runner-up by exactly 0: evidence that fits
      everything cannot rank anything.
    readout: Lead over the runner-up
    expect: { value: 0, tolerance: 0 }
    setup:
      params: { bland: 1 }
---

Evidence against hypotheses in a matrix, ranked by what contradicts each the least.

Evidence runs down the rows and hypotheses across the columns; each cell says whether an item is very consistent (CC), consistent (C), neutral (N), inconsistent (I) or very inconsistent (II) with a hypothesis. The matrix and the focus on inconsistent evidence are Heuer's; this five-point scale and the weighted inconsistency score follow the later ACH software rather than the book. Hypotheses are ranked by how much evidence contradicts them, because evidence that fits several hypotheses cannot tell them apart: an item rated alike for every hypothesis has no diagnostic value and is dimmed.

A hypothesis's score here is a weighted count of the cells against it: I counts 1 and II counts 2, times the item's weight for credibility and relevance (0.5, 1 or 1.5, a choice of this plate). The shortest bar marks the least contradicted hypothesis, a candidate to test further rather than a conclusion, and hypotheses with equal scores are reported as tied rather than ordered.

The case is synthetic. One hypothesis is chosen as true; each item mostly fits it, contradicts it with the chosen chance, and rates the others at random, and some items fit everything alike. The readouts report where the true hypothesis ranks once all evidence is weighed, and the chart shows every hypothesis's score as items are added.
