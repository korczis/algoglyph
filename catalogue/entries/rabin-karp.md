---
id: rabin-karp
title: Rabin–Karp
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
  - rolling hash
  - fingerprints
complexity: "O(n + m) expected; O(n m) when every window collides"
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Read each window as a base-256 number modulo a prime q and roll it one position in constant work.
  - Compare characters only when the window's hash equals the pattern's, so no match is reported falsely.
  - See a small modulus such as 13 produce spurious hash hits and the comparisons they cost.
  misconceptions:
  - A hash match is not a match; the characters are always compared before one is reported.
algorithm:
  paradigm: search
bounds:
  model: character comparisons and hash updates
  average: O(n + m) expected
  worst: O(n m) when every window collides
---

Compare rolling hashes of each window with the pattern's, characters only on a match.

Each window of the text is read as a base-256 number modulo a prime q. Sliding by one position subtracts the leaving character's weight and appends the entering one, a constant number of operations counted as hash updates. Only when the window's hash equals the pattern's are characters compared, so a match is always verified and never reported falsely.

Choose the modulus 13: many windows now share the pattern's hash by chance. The spurious hash hits readout counts those windows, and the readout beside it counts the character comparisons they cost before each mismatch.
