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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Match each character of the first name to an equal, unmatched character within the window of the second.
  - Count matched characters in a different order as transpositions, halved, and compute Jaro.
  - Add Winkler's bonus for up to four shared leading characters when Jaro exceeds 0.7.
  misconceptions:
  - The window does not tolerate moved words; a given name moved after the surname defeats it.
bounds:
  model: character comparisons
  worst: 'at most |a| · min(|b|, 2w + 1) for the window w = ⌊max(|a|, |b|)/2⌋ − 1: O(|a| · |b|)'
---

Matching characters within a window, transpositions halved, and a bonus for a shared prefix.

For each character of the first name the highlighted window of the second is searched for an equal character not yet matched; lines connect the matches. Matched characters that appear in a different order count as transpositions, halved. Jaro is (m/|a| + m/|b| + (m − t)/m)/3; when it exceeds 0.7, Winkler adds 0.1 for each of up to four shared leading characters times what is left to 1.

The second name is the first with noise applied: diacritics dropped, a typing slip, upper case or the given name moved after the surname. The last of these defeats the window, which is why word order is usually normalised first.
