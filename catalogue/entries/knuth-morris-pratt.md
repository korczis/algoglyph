---
id: knuth-morris-pratt
title: Knuth–Morris–Pratt
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
  - automaton
  - prefix function
complexity: "O(n + m) comparisons: at most 2n in the search and 2m in the prefix function"
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - brute-force-search
  objectives:
  - Fill the prefix function by matching the pattern against itself, pi[q] being the longest proper prefix of pattern[0..q] that is also its suffix.
  - Slide the pattern after a mismatch so that pi[q − 1] characters still match, never moving back in the text.
  - See the count stay linear on Repetitive input, where brute force's grows as n².
algorithm:
  paradigm: search
bounds:
  model: character comparisons, the prefix function's included
  worst: 'at most 2n in the search and 2m in the prefix function: O(n + m)'
claims:
  - id: pattern-128-repetitive-comparisons-bound
    statement: >-
      On Repetitive input of n = 512 with m = 128, the search compares each text character at
      least once and at most twice and the prefix function at most 2m times, so the count lies
      between n = 512 and 2n + 2m = 1,280.
    readout: Character comparisons
    expect: { range: [512, 1280] }
    setup:
      params: { shape: repetitive, n: 512, m: '128' }
  - id: pattern-64-repetitive-matches
    statement: >-
      On Repetitive input of n = 512 with m = 64, the lone b's lie at least m apart with the last
      at the end, so each one ends one occurrence of a…ab: 4 matches, the count
      String.prototype.indexOf finds in the same seeded text.
    readout: Matches
    expect: { value: 4 }
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

A mismatch tells how far the pattern can shift, so the text is never read backwards.

Before the search the pattern is matched against itself to fill the prefix function row: pi[q] is the length of the longest proper prefix of pattern[0..q] that is also its suffix. Those comparisons are counted with the search's.

During the search the text index only moves forward. After a mismatch with q characters matched, the highlighted pi[q − 1] says how many of them still match once the pattern slides, so the next comparison is against the same text character. On Repetitive input, whose pattern grows with the text, the count stays linear while brute force's grows as n².
