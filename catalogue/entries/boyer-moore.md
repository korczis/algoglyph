---
id: boyer-moore
title: Boyer–Moore
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
  - skips
  - right to left
complexity: "O(n m) worst case as written here; about n / m comparisons on large alphabets"
related:
  - knuth-morris-pratt
---

Compare from the right end of the pattern and jump by the mismatched character: sublinear in practice.

The pattern is compared from its right end. On a mismatch the slide is the larger of two shifts: the bad-character shift brings the last occurrence of the mismatched text character in the pattern under it (the Last occurrence chips), and the good-suffix shift brings the next copy of the already matched suffix, or its longest border, under it (the Good-suffix shift row, built from the pattern's borders before the search).

On English words most alignments end after one comparison and slide by nearly the whole pattern; the Alignments skipped readout counts the text positions the pattern was never tried at. On DNA the four-letter alphabet keeps the bad-character shift short.
