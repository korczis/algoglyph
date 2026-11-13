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
  - Add Winkler's bonus for up to four shared leading characters when Jaro exceeds the boost threshold, 0.7 by default.
  misconceptions:
  - The window does not tolerate moved words; a given name moved after the surname defeats it.
bounds:
  model: character comparisons
  worst: 'at most |a| · min(|b|, 2w + 1) for the window w = ⌊max(|a|, |b|)/2⌋ − 1: O(|a| · |b|)'
claims:
  - id: no-bonus-at-zero-scale
    statement: >-
      The bonus is ℓ · p · (1 − Jaro), so at the prefix scale p = 0 it vanishes and Jaro–Winkler
      equals Jaro exactly, whatever the shared prefix.
    readout: Jaro–Winkler
    expect: { against: Jaro, tolerance: 0 }
    setup:
      params: { p: 0 }
  - id: no-bonus-at-boost-one
    statement: >-
      The bonus is added only when Jaro exceeds the boost threshold, and Jaro never exceeds 1, so
      at boost = 1 Jaro–Winkler equals Jaro exactly.
    readout: Jaro–Winkler
    expect: { against: Jaro, tolerance: 0 }
    setup:
      params: { boost: 1 }
  - id: quarter-scale-bonus
    statement: >-
      The seeded pair is "Zuzana Eva Marek" against "Zuana Eva Marek": m = 15 matches, no
      transpositions, so Jaro = (15/16 + 15/15 + 1)/3 = 47/48, and the shared prefix is ℓ = 2.
      At p = 1/4 the bonus is 2 · 1/4 · 1/48 = 1/96 ≈ 0.0104; both readouts are rounded to four
      decimals, so their difference is within 0.0001 of it.
    readout: Jaro–Winkler
    expect: { against: Jaro, offset: 0.0104, tolerance: 0.0001 }
    setup:
      params: { p: 0.25 }
  - id: at-most-one-at-quarter-scale
    statement: >-
      With ℓ ≤ 4 and p ≤ 1/4, the bonus ℓ p (1 − Jaro) is at most 1 − Jaro, so Jaro–Winkler
      stays within [Jaro, 1] at the largest scale the control allows.
    readout: Jaro–Winkler
    expect: { range: [0, 1] }
    setup:
      params: { p: 0.25 }
---

Matching characters within a window, transpositions halved, and a bonus for a shared prefix.

For each character of the first name the highlighted window of the second is searched for an equal character not yet matched; lines connect the matches. Matched characters that appear in a different order count as transpositions, halved. Jaro is (m/|a| + m/|b| + (m − t)/m)/3; when it exceeds the boost threshold (0.7 by default), Winkler adds the prefix scale p (0.1 by default) for each of up to four shared leading characters times what is left to 1; p stops at 1/4, where four shared characters could just reach 1.

The second name is the first with noise applied: diacritics dropped, a typing slip, upper case or the given name moved after the surname. The last of these defeats the window, which is why word order is usually normalised first.
