---
id: jaro-winkler
title: Jaro–Winkler similarity
taxonomy: strings/similarity
status: live
engine: string
labs:
  - name-similarity
sources:
  - id: practice-entity-resolution
tags:
  - similarity
  - names
  - fuzzy matching
motivation: Resolving one company or person across noisy public registries needs it.
complexity: "O(|a| · |b|) comparisons in the worst case, O(|a| · window) as written"
related:
  - levenshtein-matrix
  - trigram-similarity
  - fellegi-sunter
---

Matching characters within a window, transpositions halved, and a bonus for a shared prefix.

For each character of the first name the highlighted window of the second is searched for an equal character not yet matched; lines connect the matches. Matched characters that appear in a different order count as transpositions, halved. Jaro is (m/|a| + m/|b| + (m − t)/m)/3; when it exceeds 0.7, Winkler adds 0.1 for each of up to four shared leading characters times what is left to 1.

The second name is the first with noise applied: diacritics dropped, a typing slip, upper case or the given name moved after the surname. The last of these defeats the window, which is why word order is usually normalised first.
