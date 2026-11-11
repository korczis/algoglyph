---
id: name-normalisation
title: Name normalisation
taxonomy: strings/similarity
status: live
engine: string
sources:
  - id: practice-entity-resolution
tags:
  - normalisation
  - diacritics
  - legal forms
motivation: Resolving one company or person across noisy public registries needs it.
complexity: "O(n) in the length of the name, plus sorting its tokens"
related:
  - blocking-sorted-neighbourhood
  - double-metaphone
  - fellegi-sunter
---

Fold case and diacritics, strip titles and legal-form suffixes, order the tokens: the canonical name.

Each character is decomposed and its combining marks dropped (Novák becomes Novak); letters such as Ł and ß, which carry their mark in the letter itself and have no decomposition, are replaced by their usual spelling (Łukasz becomes Lukasz, Weiß becomes Weiss). The case is lowered, and the name is split on spaces and commas with the punctuation stripped from each token. Academic titles before or after the name are dropped, a legal form is recognised from the joined letters of the last tokens so that s.r.o., s. r. o., spol. s r. o. and sro all become sro, and the remaining tokens are sorted; the token chips mark what was dropped and what was read as the legal form.

The readouts compare the distinct names as written with the distinct canonical keys and with the entities the input was generated from. The input varies only what normalisation folds, so the keys and the entities agree; a typo would need a similarity measure on top.
