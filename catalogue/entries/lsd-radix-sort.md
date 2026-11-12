---
id: lsd-radix-sort
title: LSD radix sort
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
  - radix
  - stable
  - non-comparison
  - digits
complexity: W passes of key-indexed counting for W digits
related:
  - counting-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites: [counting-sort]
  objectives:
  - 'Count the passes at 512 keys: the largest key has d = 5 base-4 digits, so five passes, each n writes into the auxiliary row and n back, 2,560 of each.'
  - 'Run Few distinct keys at 512 keys: the keys 1 to 4 have two base-4 digits, so two passes and 2n = 1,024 array writes.'
  - 'Explain why every pass must be stable: after the pass on digit j the keys are sorted on their last j digits, and the next pass may not undo it.'
  misconceptions:
  - 'The number of passes grows with n; it is the number of digits of the largest key: at 512 keys Few distinct keys needs two passes and Random permutation five.'
algorithm:
  paradigm: iterative-refinement
  properties:
    in_place: false
    comparison_based: false
bounds:
  model: 'array writes and auxiliary writes (each pass distributes every key into the auxiliary row and copies it back); no comparison'
  average: 'exactly d·n array writes and d·n auxiliary writes on every input, d = ⌊log₄ k⌋ + 1 the base-4 digits of the largest key k: d = 5 for the plate''s largest keys 511 and 512, d = 2 for Few distinct keys'
claims:
  - id: passes-follow-the-digits
    statement: >-
      On Few distinct keys at 512 keys LSD radix sort makes two passes, since the keys 1 to 4 have two base-4 digits: 2n = 1,024 array writes, where Random permutation at 512 keys needs five passes and 2,560.
    readout: Array writes
    expect: { value: 1024 }
    setup:
      params: { shape: few-unique, n: 512, speed: 2000 }
---

Sort by the least significant base-4 digit first, with one stable counting pass per digit.

After the pass on digit d, the keys are sorted on their last d digits; stability is what keeps the earlier passes intact.
