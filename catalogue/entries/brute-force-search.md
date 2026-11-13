---
id: brute-force-search
title: Brute-force string search
taxonomy: strings/search
status: live
engine: string
labs:
  - string-search
sources:
  - id: sedgewick-aic-1990
    ref: String Processing
tags:
  - string search
  - baseline
complexity: "worst case m(n − m + 1) comparisons; about n on random text"
related:
  - knuth-morris-pratt
  - boyer-moore
  - rabin-karp
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Try the pattern at every alignment and compare left to right until the first mismatch.
  - See why English words or DNA keep the work close to the text length, a mismatch coming early.
  - See Repetitive input, whose pattern a…ab grows with the text, drive the work towards m(n − m + 1).
algorithm:
  paradigm: search
bounds:
  model: character comparisons
  average: 'close to n on English words or DNA, where a mismatch comes at the first or second character'
  worst: 'm(n − m + 1) for a text of n and a pattern of m characters'
claims:
  - id: pattern-32-alignments-identity
    statement: >-
      With the pattern length fixed at 32 on DNA of n = 512 characters, every alignment from 0 to
      n − m is tried once, so Alignments tried is n − m + 1 = 481, exactly.
    readout: Alignments tried
    expect: { value: 481 }
    setup:
      params: { shape: dna, n: 512, m: '32' }
  - id: pattern-64-repetitive-comparisons-bound
    statement: >-
      On Repetitive input of n = 512 with m = 64, each of the n − m + 1 = 449 alignments costs at
      least one comparison and at most m, so the count lies between 449 and m(n − m + 1) =
      28,736.
    readout: Character comparisons
    expect: { range: [449, 28736] }
    setup:
      params: { shape: repetitive, n: 512, m: '64' }
  - id: pattern-4-dna-matches-indexof
    statement: >-
      With a pattern of 4 DNA letters in n = 512 the search finds 3 matches, the count
      String.prototype.indexOf finds in the same seeded text (an independent search).
    readout: Matches
    expect: { value: 3 }
    setup:
      params: { shape: dna, n: 512, m: '4' }

---

Try the pattern at every position of the text and compare character by character.

Every alignment of the pattern is tried in turn and compared left to right until the first mismatch. On English words or DNA a mismatch usually comes at the first or second character, so the work stays close to the text length; choose Repetitive, whose pattern a…ab grows with the text, and most alignments match a long run of a before the mismatch: the work approaches the m(n − m + 1) worst case the other searches avoid and grows as n². Pattern length fixes m for every shape instead, up to 128 characters.

The chart plots the character comparisons counted so far against the alignment being tried; its slope is the comparisons spent per alignment.
