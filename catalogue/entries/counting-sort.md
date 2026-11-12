---
id: counting-sort
title: Key-indexed counting
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
  - counting
  - stable
  - non-comparison
complexity: n + R operations for keys in 0..R−1
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - 'Read the counters on any input of n keys: no comparison, n Auxiliary writes for the distribution and n Array writes for the copy back, 512 of each at 512 keys.'
  - 'Explain how the counts, turned into start positions, send every key straight to its own slot of the auxiliary row.'
  - 'Explain why the drawn cost does not change with the order of the keys, and where the key range R enters: in the count table, which the plate neither draws nor counts.'
  misconceptions:
  - 'Counting sort compares keys to find their places; the comparison counter stays at zero on every input, because a key''s value is its address.'
algorithm:
  properties:
    in_place: false
    comparison_based: false
bounds:
  model: 'array writes and auxiliary writes (one write per key into the auxiliary row, one per key back); the count table over the key range is not drawn and its updates are not counted'
  average: 'exactly n auxiliary writes, n array writes and no comparison on every input'
claims:
  - id: one-write-each-way
    statement: >-
      On Random permutation at 512 keys key-indexed counting makes exactly n = 512 array writes, the copy back of the one distribution into the auxiliary row, and no comparison.
    readout: Array writes
    expect: { value: 512 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Count every key, turn the counts into start positions, and distribute the keys into the auxiliary array.

There are no comparisons at all: the comparison counter stays at zero. The count table itself is not drawn; the lower strip is the distribution.

It is the stable step that LSD radix sort repeats once per digit.
