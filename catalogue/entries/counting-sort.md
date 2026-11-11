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
---

Count every key, turn the counts into start positions, and distribute the keys into the auxiliary array.

There are no comparisons at all: the comparison counter stays at zero. The count table itself is not drawn; the lower strip is the distribution.

It is the stable step that LSD radix sort repeats once per digit.
