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
---

Compare only records that share a key or sort near each other, instead of every pair.

Each record's key is built from its name with the diacritics folded. Standard blocking uses the first three letters of the surname and the first letter of the given name and compares only records with equal keys; sorted neighbourhood sorts on the whole surname and given name and compares each record with the next w − 1 in that order.

The readouts measure the trade: the share of all pairs no longer compared, and how many of the true duplicate pairs (records generated from one person) are still among the candidates. A typo in the first letters splits a block, while a sorted window still catches a typo near the end of a name.
