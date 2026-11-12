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
---

The weighted sum modulo 11 that makes the last digit of a Czech company number check the rest.

The first seven digits are weighted 8, 7, 6, 5, 4, 3 and 2 and summed; the eighth digit must equal (11 − sum mod 11) mod 10. Because every weight is non-zero modulo 11, a single changed digit among the first seven, or two adjacent distinct digits swapped, always changes the remainder.

Remainders 0 and 10 both give check digit 1, so a corruption that moves the sum between them is not caught. The input corrupts some of the numbers; the readouts count the corrupted numbers that were caught and those that still check.
