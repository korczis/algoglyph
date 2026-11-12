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
claims:
  - id: tallies-with-four-lengths-tried
    statement: >-
      Each candidate length tallies all n letters once, over its columns, and the key's columns
      tally them once more: n · min(L_max, ⌊n/4⌋) + n. For n = 420 and L_max = 4 that is
      420 · 4 + 420 = 2100, exactly.
    readout: Letters tallied
    expect: { value: 2100 }
    setup:
      params: { lmax: 4 }
  - id: tallies-with-eight-lengths-tried
    statement: >-
      The same count at L_max = 8: 420 · 8 + 420 = 3780, exactly.
    readout: Letters tallied
    expect: { value: 3780 }
    setup:
      params: { lmax: 8 }
  - id: key-length-at-most-the-longest-tried
    statement: >-
      The key length is chosen among the candidates 1 to L_max, so with L_max = 2 it is 1 or 2,
      whatever the key really is.
    readout: Key length found
    expect: { range: [1, 2] }
    setup:
      params: { lmax: 2 }
---

A repeating keyword shifts each letter; the key's length falls out of repeated fragments.

The first rows encrypt: each plaintext letter is shifted by the key letter under it. The attack then reads only the ciphertext. The repeat distances are the gaps between repeated trigrams (Kasiski's test); the chart plots the mean index of coincidence of the columns i mod L for every candidate length L up to the longest key tried (16 unless the control shortens it, and never more than n/4), which rises from about 0.04 for shuffled letters towards the value of English when L is a multiple of the key's length. The smallest L within 90% of the best is taken.

Each column is then a Caesar cipher: the shift whose letter counts are closest, by chi-squared, to English letter frequencies gives one key letter. The Correct readout compares the recovered key with the one used.
