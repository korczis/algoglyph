---
id: double-metaphone
title: "Phonetic keys: Soundex and Double Metaphone"
taxonomy: strings/similarity
status: live
engine: string
sources:
  - id: practice-entity-resolution
tags:
  - phonetics
  - names
  - transliteration
motivation: Resolving one company or person across noisy public registries needs it.
complexity: "O(n) in the length of the name"
related:
  - name-normalisation
  - jaro-winkler
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Keep the first letter and up to three digit classes of the consonants that follow, for Soundex.
  - Walk the name with Double Metaphone's context rules and write a primary and an alternate key.
  - Count how many spellings of one name meet on each key, and see a changed sound keep a pair apart.
bounds:
  model: letters coded and Metaphone rules applied
  worst: 'at most n of each for a name of n letters: Soundex reads each letter at most once, and each Metaphone rule consumes at least one'
---

Names reduced to how they sound, so differently transliterated spellings meet.

Soundex keeps the first letter and up to three digit classes of the consonants that follow (B F P V, C G J K Q S X Z, D T, L, M N, R), merging neighbours of one class. Double Metaphone walks the name with context rules for letter groups such as sch, cz, wicz, gh, th and ch, highlighted as they are consumed, and writes a primary key and an alternate where a spelling has two plausible pronunciations ('0' is the th sound, X is sh).

The input is Czech surnames with the spellings German, Polish and English records give them. The readouts count the pairs of spellings of one name and how many meet on Soundex and on Double Metaphone; a spelling that changes a sound, such as rz for ř in Dworzak against Dvorak, can keep a pair apart on both.
