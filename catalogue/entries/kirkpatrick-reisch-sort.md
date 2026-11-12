---
id: kirkpatrick-reisch-sort
title: Kirkpatrick–Reisch sort
taxonomy: sorting/radix
status: live
engine: array
labs:
  - sorting
sources:
  - id: kirkpatrick-1984
    ref: the range-reduction result
  - id: kirkpatrick-1981
    ref: the earlier technical report
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
tags:
  - sorting
  - radix
  - integer sorting
  - range reduction
  - word ram
complexity: n + n log(b / log n) for b-bit keys; extra space n + 2^(b/2)
related:
  - bucket-sort
  - counting-sort
  - lsd-radix-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [counting-sort]
  objectives:
  - 'Watch the Phase readout: on every plate input the keys are split twice, from 32 bits to 16 and from 16 to 8, before a counting sort on 8-bit keys.'
  - 'Count the comparisons at 512 keys: 2n − 1 − g, the n − 1 that find the minimum low half of the single 32-bit group and n − g for the g groups of the 16-bit level, 1,019 on Random permutation.'
  - 'Read the Auxiliary writes: exactly 3n, one list of n keys for each of the three levels.'
  misconceptions:
  - 'An integer sort that beats n log n makes no comparisons; this one compares low halves to find each group''s minimum, 2n − 1 − g times.'
algorithm:
  properties:
    stable: false
    in_place: false
bounds:
  model: 'comparisons (finding each group''s minimum low half), array writes (one per key, the sorted output) and auxiliary writes (the n keys of each level''s list)'
  average: 'on every plate input of n ≥ 2 keys exactly 2n − 1 − g comparisons, n array writes and 3n auxiliary writes, g the groups of the 16-bit level: one for the high half of the 32-bit group and one for every distinct high byte of the keys other than the minimum'
claims:
  - id: random-comparisons
    statement: >-
      On Random permutation at 512 keys Kirkpatrick–Reisch sort makes 2n − 1 − g = 1,019 comparisons, with g = 4 groups at the 16-bit level: the 32-bit group's high half, and the high bytes 0, 1 and 2 of the keys 2 to 512.
    readout: Comparisons
    expect: { value: 1019 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Sort b-bit integers by range reduction: split every key into its high and low halves, group the keys by high half, and reduce the problem in linear time to sorting n keys of b/2 bits; repeat until the keys are short enough for a counting sort.

The trick at each level is that a group contributes its high half once and its other members' low halves, while its minimum is set aside; sorting that mixed list of half-length keys yields both the order of the groups and the order inside each group. The lower strips show the lists of each level as the key length halves.

Kirkpatrick and Reisch show that on a RAM with addition, subtraction and shifts, n integers from the range 0 to n^c can be sorted in time proportional to n log c + n. For b-bit words c is b / log n, which is how the bound above arises, and it beats radix sort, whose time for the same range grows like n·c. Start with Random permutation at n = 512: the plate's keys are short, so on every input the recursion splits them twice, from 32 bits to 16 and from 16 to 8, and a counting sort finishes on 8-bit keys.

It is above all a theoretical result: the bucket table of size 2^(b/2) is impractical for large words, which is why radix sort with a well-chosen base wins in practice. The kernel groups by direct addressing where the paper hashes for large words, and the method is not stable.
