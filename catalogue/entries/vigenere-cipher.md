---
id: vigenere-cipher
title: Vigenère cipher and its frequency attack
taxonomy: strings/cryptology
status: live
engine: string
sources:
  - id: sedgewick-aic-1990
    ref: String Processing
tags:
  - cryptology
  - substitution
  - frequency analysis
complexity: "O(n L_max) letter tallies for n letters and candidate key lengths up to L_max"
related:
  - entropy-map
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Shift each plaintext letter by the key letter under it.
  - Find the key's length from the ciphertext alone, by Kasiski's repeat distances and the mean index of coincidence.
  - Recover each key letter by treating its column as a Caesar cipher fitted to English letter frequencies.
bounds:
  model: letter shifts and letters tallied
  worst: 'n shifts to encrypt; n tallies for each candidate key length up to L_max and n for the key letters, n(L_max + 1): O(n L_max)'
---

A repeating keyword shifts each letter; the key's length falls out of repeated fragments.

The first rows encrypt: each plaintext letter is shifted by the key letter under it. The attack then reads only the ciphertext. The repeat distances are the gaps between repeated trigrams (Kasiski's test); the chart plots the mean index of coincidence of the columns i mod L for every candidate length L, which rises from about 0.04 for shuffled letters towards the value of English when L is a multiple of the key's length. The smallest L within 90% of the best is taken.

Each column is then a Caesar cipher: the shift whose letter counts are closest, by chi-squared, to English letter frequencies gives one key letter. The Correct readout compares the recovered key with the one used.
