---
id: base-rate-roc
title: Base rates and the ROC curve
taxonomy: inference/uncertainty
status: live
engine: stochastic
sources:
  - id: practice-decisions
tags:
  - base rates
  - roc
  - false alarms
complexity: "n log n to sort the scores for the full curve"
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
---

Why a good detector of a rare thing raises mostly false alarms, with the threshold to play with.

The ROC curve plots the true positive rate against the false positive rate as the threshold falls; its area equals the probability that a random positive outscores a random negative (the Mann–Whitney statistic), and for two unit normals d' apart it is Φ(d'/√2). Neither depends on how rare positives are.

Precision does. With positives at one per cent, a detector that catches most of them while alarming on only a few per cent of negatives still produces mostly false alarms, because the negatives outnumber the positives ninety-nine to one. The class histograms are drawn as proportions within each class, so the rare class stays visible.
