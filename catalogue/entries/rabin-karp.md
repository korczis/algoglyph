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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Read each window as a base-R number (radix 256 by default) modulo a prime q and roll it one position in constant work.
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
claims:
  - id: radix-two-finds-every-match
    statement: >-
      A match is reported only after its characters are compared, so the radix moves the hash
      collisions but never the matches: at radix 2 the plate still finds the one occurrence of
      the pattern "been" that indexOf finds in the seeded text (n = 96).
    readout: Matches
    expect: { value: 1 }
    setup:
      params: { R: '2' }
  - id: hash-updates-independent-of-radix
    statement: >-
      The pattern and the first window take m hash steps each and every slide one more, so a
      text of n characters costs 2m + (n − m) = n + m updates at any radix: 96 + 4 = 100 at
      radix 31, exactly.
    readout: Hash updates
    expect: { value: 100 }
    setup:
      params: { R: '31' }
  - id: pattern-32-hash-updates-identity
    statement: >-
      With the pattern length fixed at 32 on DNA of n = 512 characters, the pattern and the first
      window take m hash steps each and each of the n − m slides one more: 2m + (n − m) = 544
      updates, exactly.
    readout: Hash updates
    expect: { value: 544 }
    setup:
      params: { shape: dna, n: 512, m: '32' }
  - id: pattern-8-hash-updates-identity
    statement: >-
      With the pattern length fixed at 8 on DNA of n = 96 characters, the count is 2m + (n − m) =
      16 + 88 = 104 updates, exactly.
    readout: Hash updates
    expect: { value: 104 }
    setup:
      params: { shape: dna, n: 96, m: '8' }
  - id: pattern-4-dna-matches-indexof
    statement: >-
      With a pattern of 4 DNA letters in n = 512 the search finds 3 matches, the count
      String.prototype.indexOf finds in the same seeded text, whatever spurious hits the hash
      makes.
    readout: Matches
    expect: { value: 3 }
    setup:
      params: { shape: dna, n: 512, m: '4' }

---

Compare rolling hashes of each window with the pattern's, characters only on a match.

Each window of the text is read as a base-R number modulo a prime q, the radix R 256 unless the control changes it. Sliding by one position subtracts the leaving character's weight and appends the entering one, a constant number of operations counted as hash updates. Only when the window's hash equals the pattern's are characters compared, so a match is always verified and never reported falsely.

Choose the modulus 13: many windows now share the pattern's hash by chance. The spurious hash hits readout counts those windows, and the readout beside it counts the character comparisons they cost before each mismatch.
