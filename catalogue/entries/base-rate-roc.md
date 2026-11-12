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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Read the area under the ROC curve as the chance that a random positive outscores a random negative, Φ(d'/√2) for two unit normals d' apart.
    - Explain why the ROC curve and its area do not depend on how rare positives are, while precision does.
    - Show why a good detector of a rare class still raises mostly false alarms.
claims:
  - id: auc-is-binormal-at-a-rare-base-rate
    statement: >-
      At the default rare base rate (1% of 20,000 cases, d' = 2) the area under the empirical ROC
      curve is the binormal Φ(d'/√2) = 0.9214, within three standard errors of the Mann–Whitney
      statistic for about 200 positives and 19,800 negatives (0.028).
    readout: AUC
    expect: { value: 0.9214, tolerance: 0.028 }
  - id: auc-is-the-same-at-a-common-base-rate
    statement: >-
      With positives at half of 100,000 cases the area is the same Φ(d'/√2) = 0.9214, within three
      standard errors of the Mann–Whitney statistic for 50,000 cases of each class (0.0025): the
      area does not depend on the base rate.
    readout: AUC
    expect: { value: 0.9214, tolerance: 0.0025 }
    setup:
      params: { rate: 0.5, n: 100000 }
  - id: default-threshold-catches-about-half
    statement: >-
      At the default threshold, which equals d' = 2, the detector catches Φ(0) = 50% of the
      positives, within three binomial standard errors for about 200 positives (10.6 points).
    readout: True / false positive rate
    expect: { value: 50, tolerance: 10.6 }
  - id: lower-threshold-catches-about-two-thirds
    statement: >-
      At threshold 1.5 the detector catches Φ(0.5) = 69.1% of the positives, within three binomial
      standard errors for about 200 positives (9.8 points).
    readout: True / false positive rate
    expect: { value: 69.1, tolerance: 9.8 }
    setup:
      params: { threshold: 1.5 }
  - id: rare-positives-mostly-false-alarms
    statement: >-
      At threshold 1.5, with positives at one per cent, the detector catches about two thirds of
      them and alarms on about 6.7% of the negatives, yet most alarms are false: precision is below
      50% (analytically 0.01·0.691 / (0.01·0.691 + 0.99·0.067) ≈ 9.5%).
    readout: Precision (alarms that are real)
    expect: { below: 50 }
    setup:
      params: { threshold: 1.5 }
---

Why a good detector of a rare thing raises mostly false alarms, with the threshold to play with.

The ROC curve plots the true positive rate against the false positive rate as the threshold falls; its area equals the probability that a random positive outscores a random negative (the Mann–Whitney statistic), and for two unit normals d' apart it is Φ(d'/√2). Neither depends on how rare positives are.

Precision does. With positives at one per cent, a detector that catches about half of them at the default threshold, which equals d', or about two thirds at threshold 1.5, while alarming on only a few per cent of negatives, still produces mostly false alarms, because the negatives outnumber the positives ninety-nine to one. The class histograms are drawn as proportions within each class, so the rare class stays visible.
