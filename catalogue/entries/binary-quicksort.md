---
id: binary-quicksort
title: Binary quicksort
taxonomy: sorting/radix
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - radix exchange
  - bits
  - non-comparison
  - in-place
complexity: about n lg n bit examinations
related:
  - quicksort
  - msd-radix-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [quicksort]
  objectives:
  - 'Read the comparison counter: zero on every input, since a partition looks at one bit of each key, never at another key.'
  - 'Count Reversed: ⌊n/2⌋ exchanges in all, 512 array writes at 512 keys; Already sorted makes none.'
  - 'Explain why each partition makes exactly as many exchanges as there are keys with the bit set in the zone the keys with the bit clear will fill: every exchange puts two keys on their side.'
  misconceptions:
  - 'Radix exchange is stable because it never compares keys; its exchanges cross equal keys, and [2, 1, 1] ends with its two 1s in the opposite order.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
    comparison_based: false
bounds:
  model: 'array writes (each exchange two); no comparison and no auxiliary write'
  best: 'no write on Already sorted'
  average: 'each partition exactly one exchange per key with the bit set among the positions the keys with the bit clear will fill, the fewest a two-way split can make; ⌊n/2⌋ exchanges on Reversed'
claims:
  - id: reversed-half-n-exchanges
    statement: >-
      On Reversed at 512 keys radix exchange makes ⌊n/2⌋ = 256 exchanges, 512 array writes, and no comparison.
    readout: Array writes
    expect: { value: 512 }
    setup:
      params: { shape: reversed, n: 512, speed: 2000 }
---

Radix exchange: partition on the leading bit, then recurse on the next bit.

It partitions like quicksort but on a bit instead of a pivot key, so the comparison counter stays at zero and the bands split exactly at powers of two.
