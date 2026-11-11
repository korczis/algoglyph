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
related:
  - brute-force-search
---

Compare rolling hashes of each window with the pattern's, characters only on a match.

Each window of the text is read as a base-256 number modulo a prime q. Sliding by one position subtracts the leaving character's weight and appends the entering one, a constant number of operations counted as hash updates. Only when the window's hash equals the pattern's are characters compared, so a match is always verified and never reported falsely.

Choose the modulus 13: many windows now share the pattern's hash by chance, and the readout of spurious hash hits counts the character comparisons that collisions cost.
