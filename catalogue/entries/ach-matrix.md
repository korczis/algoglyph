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
motivation: Link analysis in investigations and due diligence leans on it.
complexity: 'O(evidence × hypotheses) to score and rank'
interaction: 'Click a cell to cycle its rating through II, I, N, C and CC; the scores and the ranking follow.'
related:
  - bayes-update
  - dempster-shafer
---

Evidence against hypotheses in a matrix, ranked by what contradicts each the least.

Evidence runs down the rows and hypotheses across the columns; each cell says whether an item is very consistent (CC), consistent (C), neutral (N), inconsistent (I) or very inconsistent (II) with a hypothesis. Hypotheses are ranked by how much evidence contradicts them, because evidence that fits several hypotheses cannot tell them apart: an item rated alike for every hypothesis has no diagnostic value and is dimmed.

A hypothesis's score here is a weighted count of the cells against it: I counts 1 and II counts 2, times the item's weight for credibility and relevance (0.5, 1 or 1.5, a choice of this plate). The shortest bar marks the least contradicted hypothesis, a candidate to test further rather than a conclusion.

The case is synthetic. One hypothesis is chosen as true; each item mostly fits it, contradicts it with the chosen chance, and rates the others at random, and some items fit everything alike. The readouts report where the true hypothesis ranks once all evidence is weighed, and the chart shows every hypothesis's score as items are added.
