---
id: blocking-sorted-neighbourhood
title: Blocking and sorted neighbourhood
taxonomy: strings/similarity
status: live
engine: string
sources:
  - id: practice-entity-resolution
tags:
  - entity resolution
  - blocking
  - candidate pairs
motivation: Resolving one company or person across noisy public registries needs it.
complexity: "O(n log n) to sort the keys, then O(n w) candidate pairs instead of n(n − 1)/2"
related:
  - fellegi-sunter
  - name-normalisation
  - union-find-entity-merge
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Build each record's key from its name with the diacritics folded.
  - Compare only records with equal keys (standard blocking), or each record with the next w − 1 in key order (sorted neighbourhood).
  - Weigh the share of pairs no longer compared against the true duplicate pairs still among the candidates.
bounds:
  model: candidate pairs, sorted neighbourhood with window w
  worst: 'Σᵢ min(w − 1, n − 1 − i) ≤ (w − 1) n for n records, against n(n − 1)/2 for all pairs; the sort takes O(n log n) key comparisons'
---

Compare only records that share a key or sort near each other, instead of every pair.

Each record's key is built from its name with the diacritics folded. Standard blocking uses the first three letters of the surname and the first letter of the given name and compares only records with equal keys; sorted neighbourhood sorts on the whole surname and given name and compares each record with the next w − 1 in that order.

The readouts measure the trade: the share of all pairs no longer compared, and how many of the true duplicate pairs (records generated from one person) are still among the candidates. A typo in the first letters splits a block, while a sorted window still catches a typo near the end of a name.
