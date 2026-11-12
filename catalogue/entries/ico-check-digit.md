---
id: ico-check-digit
title: IČO check digit
taxonomy: strings/cryptology
status: live
engine: string
sources:
  - id: practice-entity-resolution
tags:
  - check digit
  - identifiers
  - mod 11
motivation: Resolving one company or person across noisy public registries needs it.
complexity: "O(1) per number: seven multiplications and one remainder"
related:
  - crc-division
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Weight the first seven digits 8 to 2, sum them and take (11 − sum mod 11) mod 10 as the check digit.
  - See why one changed digit, or two adjacent distinct digits swapped, always changes the remainder.
  - See why a corruption that moves the sum between remainders 0 and 10 is not caught.
bounds:
  model: digits weighted and numbers checked
  best: 7 digits weighted and 1 check per number
  worst: 7 digits weighted and 1 check per number
---

The weighted sum modulo 11 that makes the last digit of a Czech company number check the rest.

The first seven digits are weighted 8, 7, 6, 5, 4, 3 and 2 and summed; the eighth digit must equal (11 − sum mod 11) mod 10. Because every weight is non-zero modulo 11, a single changed digit among the first seven, or two adjacent distinct digits swapped, always changes the remainder.

Remainders 0 and 10 both give check digit 1, so a corruption that moves the sum between them is not caught. The input corrupts some of the numbers; the readouts count the corrupted numbers that were caught and those that still check.
