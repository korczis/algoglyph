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
related:
  - brute-force-search
---

A mismatch tells how far the pattern can shift, so the text is never read backwards.

Before the search the pattern is matched against itself to fill the prefix function row: pi[q] is the length of the longest proper prefix of pattern[0..q] that is also its suffix. Those comparisons are counted with the search's.

During the search the text index only moves forward. After a mismatch with q characters matched, the highlighted pi[q − 1] says how many of them still match once the pattern slides, so the next comparison is against the same text character. On Repetitive input the count stays linear where brute force goes quadratic.
