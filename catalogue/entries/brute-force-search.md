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
---

Try the pattern at every position of the text and compare character by character.

Every alignment of the pattern is tried in turn and compared left to right until the first mismatch. On English words or DNA a mismatch usually comes at the first or second character, so the work stays close to the text length; choose Repetitive, whose pattern a…ab grows with the text, and most alignments match a long run of a before the mismatch: the work approaches the m(n − m + 1) worst case the other searches avoid and grows as n².

The chart plots the character comparisons counted so far against the alignment being tried; its slope is the comparisons spent per alignment.
