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
---

A mismatch tells how far the pattern can shift, so the text is never read backwards.

Before the search the pattern is matched against itself to fill the prefix function row: pi[q] is the length of the longest proper prefix of pattern[0..q] that is also its suffix. Those comparisons are counted with the search's.

During the search the text index only moves forward. After a mismatch with q characters matched, the highlighted pi[q − 1] says how many of them still match once the pattern slides, so the next comparison is against the same text character. On Repetitive input, whose pattern grows with the text, the count stays linear while brute force's grows as n².
