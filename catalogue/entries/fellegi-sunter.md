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
  - jaro-winkler
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
  - Turn every pair of records into an agreement vector over given name, surname, birth year and town.
  - Fit m and u per field by EM, without labels, and weight agreement by log2(m/u) and disagreement by log2((1 − m)/(1 − u)).
  - Call a pair a match above log2((1 − p)/p), where its posterior passes one half.
algorithm:
  paradigm: iterative-refinement
bounds:
  model: field comparisons and EM pair updates
  worst: '4 · n(n − 1)/2 field comparisons for n records, every pair on four fields; n(n − 1)/2 pair updates per EM iteration'
---

Each field adds the log ratio of agreeing among matches to agreeing among non-matches.

Every pair of records is compared on given name, surname, birth year and town (folded, case-blind equality), giving an agreement vector. EM fits a mixture of matches and non-matches to those vectors without labels: the table shows each field's m (agreement among matches), u (agreement among non-matches) and the weights log2(m/u) for agreeing and log2((1 − m)/(1 − u)) for disagreeing.

A pair's weight is the sum over its fields, and it is called a match above log2((1 − p)/p), where its posterior passes one half. The chart is the histogram of all pair weights, split by whether the records really come from one person; precision and recall are counted against that truth.
