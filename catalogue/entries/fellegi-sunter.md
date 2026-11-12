---
id: fellegi-sunter
title: Fellegi–Sunter match weights
taxonomy: strings/similarity
status: live
engine: string
sources:
  - id: practice-entity-resolution
tags:
  - record linkage
  - likelihood ratios
motivation: Resolving one company or person across noisy public registries needs it.
complexity: "O(n² f) field comparisons for n records and f fields, then O(n² f) per EM iteration"
related:
  - blocking-sorted-neighbourhood
  - jaro-winkler
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
  - Turn every pair of records into an agreement vector over given name, surname, birth year and town, or the fewer fields the control picks.
  - Fit m and u per field by EM, without labels, and weight agreement by log2(m/u) and disagreement by log2((1 − m)/(1 − u)).
  - Call a pair a match above log2((1 − p)/p), where its posterior passes one half.
algorithm:
  paradigm: iterative-refinement
bounds:
  model: field comparisons and EM pair updates
  worst: 'f · n(n − 1)/2 field comparisons for n records and f fields compared (four by default); n(n − 1)/2 pair updates per EM iteration'
claims:
  - id: two-fields-two-comparisons-per-pair
    statement: >-
      Each pair is compared once on each field: the seeded input holds 30 records, 435 pairs,
      so the given name and surname alone take 2 · 435 = 870 field comparisons, exactly.
    readout: Field comparisons
    expect: { value: 870 }
    setup:
      params: { fields: name }
  - id: three-fields-three-comparisons-per-pair
    statement: >-
      With the year added, 3 · 435 = 1305 field comparisons, exactly.
    readout: Field comparisons
    expect: { value: 1305 }
    setup:
      params: { fields: nameyear }
  - id: recall-a-share-on-two-fields
    statement: >-
      Recall is the true pairs called over all true pairs, a share, so it lies in [0, 1] on
      whatever fields the model is fitted.
    readout: Recall
    expect: { range: [0, 1] }
    setup:
      params: { fields: name }
  - id: precision-a-share-on-three-fields
    statement: >-
      Precision is the true pairs called over all pairs called, a share in [0, 1].
    readout: Precision
    expect: { range: [0, 1] }
    setup:
      params: { fields: nameyear }
---

Each field adds the log ratio of agreeing among matches to agreeing among non-matches.

Every pair of records is compared on given name, surname, birth year and town (folded, case-blind equality), giving an agreement vector; the control can drop the town, or the town and the year, to show what the fields left carry. EM fits a mixture of matches and non-matches to those vectors without labels: the table shows each field's m (agreement among matches), u (agreement among non-matches) and the weights log2(m/u) for agreeing and log2((1 − m)/(1 − u)) for disagreeing.

A pair's weight is the sum over its fields, and it is called a match above log2((1 − p)/p), where its posterior passes one half. The chart is the histogram of all pair weights, split by whether the records really come from one person; precision and recall are counted against that truth.
